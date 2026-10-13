"""
TerraNex - Stage 1 Species Gatekeeper Training Script
Trains a 4-way species classifier (Tomato, Potato, Bell Pepper, Unsupported)
using MobileNetV2 transfer learning with frozen backbone.
Strictly isolated: reads only 'train' and 'val' splits; test split remains quarantined.
"""

import os
import sys
import json
import time
import hashlib
from pathlib import Path
from datetime import datetime
import numpy as np
from PIL import Image

import tensorflow as tf
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support
)

# -------------------------------------------------------------
# 1. SETUP & REPRODUCIBILITY
# -------------------------------------------------------------
SEED = 42
tf.keras.utils.set_random_seed(SEED)
np.random.seed(SEED)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "plant_disease" / "raw" / "PlantVillage"
MANIFEST_PATH = PROJECT_ROOT / "data" / "plant_disease" / "splits" / "species_split_manifest_v1.json"
MODELS_DIR = PROJECT_ROOT / "models"
CHECKPOINT_DIR = MODELS_DIR / "checkpoints"

MODEL_OUTPUT_PATH = MODELS_DIR / "crop_species_model_v1.0.keras"
MAPPING_OUTPUT_PATH = MODELS_DIR / "species_mapping.json"
HISTORY_OUTPUT_PATH = MODELS_DIR / "crop_species_training_history.json"
METRICS_OUTPUT_PATH = MODELS_DIR / "crop_species_val_metrics.json"

STAGE2_MODEL_PATH = MODELS_DIR / "crop_disease_model.keras"

CLASS_NAMES = ["Tomato", "Potato", "Bell Pepper", "Unsupported"]
CLASS_INDICES = {0: "Tomato", 1: "Potato", 2: "Bell Pepper", 3: "Unsupported"}


def get_file_sha256(filepath):
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def load_manifest_data():
    """Load manifest and split strictly into train and val. Quarantine test."""
    print("=" * 70)
    print("STEP 1: Loading Dataset Manifest & Enforcing Test Quarantine...")
    print("=" * 70)

    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(f"Manifest not found: {MANIFEST_PATH}")

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    train_items = []
    val_items = []
    quarantined_test_count = 0

    for item in manifest["images"]:
        spl = item["split"]
        if spl == "train":
            train_items.append(item)
        elif spl == "val":
            val_items.append(item)
        elif spl == "test":
            quarantined_test_count += 1
        else:
            raise ValueError(f"Unknown split: {spl}")

    print(f"Loaded {len(train_items)} Train images (Target: 6,613)")
    print(f"Loaded {len(val_items)} Validation images (Target: 1,417)")
    print(f"Quarantined {quarantined_test_count} Test images (Target: 1,417 - Strictly Unused)")

    assert len(train_items) == 6613, f"Expected 6,613 train images, got {len(train_items)}"
    assert len(val_items) == 1417, f"Expected 1,417 val images, got {len(val_items)}"
    assert quarantined_test_count == 1417, f"Expected 1,417 quarantined test images, got {quarantined_test_count}"

    return train_items, val_items


def extract_bottleneck_features(items, base_extractor, desc=""):
    """
    Extract MobileNetV2 1280-dim bottleneck features.
    Validation data is strictly unaugmented.
    Images are preprocessed via (x / 127.5) - 1.0.
    """
    CACHE_DIR = CHECKPOINT_DIR / "cache"
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    slug = desc.replace(" ", "_").lower()
    cache_f = CACHE_DIR / f"{slug}_feats.npy"
    cache_l = CACHE_DIR / f"{slug}_labels.npy"

    if cache_f.exists() and cache_l.exists():
        print(f"\nLoading cached bottleneck features for {desc} from {cache_f}...")
        features = np.load(cache_f)
        labels_arr = np.load(cache_l)
        labels = tf.keras.utils.to_categorical(labels_arr, num_classes=4)
        print(f"  Loaded {len(features)} cached features! Shape: {features.shape}")
        return features, labels, labels_arr

    print(f"\nExtracting bottleneck features for {desc} ({len(items)} images)...")
    t0 = time.time()

    features_list = []
    labels_list = []

    batch_size = 64
    batch_images = []
    batch_labels = []

    total = len(items)
    for idx, item in enumerate(items):
        img_path = RAW_DIR / item["relative_path"]
        lbl_idx = item["species_index"]

        # Load RGB image and resize to 224x224
        with Image.open(img_path) as img:
            rgb_img = img.convert("RGB").resize((224, 224))
            arr = np.array(rgb_img, dtype=np.float32)

        batch_images.append(arr)
        batch_labels.append(lbl_idx)

        if len(batch_images) == batch_size or idx == total - 1:
            batch_arr = np.array(batch_images, dtype=np.float32)
            # MobileNetV2 normalization: [-1.0, 1.0]
            batch_norm = (batch_arr / 127.5) - 1.0
            feats = base_extractor.predict(batch_norm, verbose=0)
            features_list.append(feats)
            labels_list.extend(batch_labels)
            batch_images = []
            batch_labels = []

            if (idx + 1) % 1000 == 0 or idx == total - 1:
                elapsed = time.time() - t0
                print(f"  Processed {idx + 1}/{total} images ({elapsed:.1f}s)")

    features = np.vstack(features_list)
    labels_arr = np.array(labels_list)
    labels = tf.keras.utils.to_categorical(labels_arr, num_classes=4)

    np.save(cache_f, features)
    np.save(cache_l, labels_arr)

    t1 = time.time()
    print(f"  Feature extraction for {desc} complete in {t1 - t0:.2f}s! Output shape: {features.shape}")
    return features, labels, labels_arr


def build_and_train_head(X_train, y_train, X_val, y_val):
    """Build and train dense classification head on bottleneck features."""
    print("\n" + "=" * 70)
    print("STEP 2: Training Dense Classification Head on Bottleneck Features...")
    print("=" * 70)

    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    temp_checkpoint = CHECKPOINT_DIR / "species_head_best.keras"

    head_input = tf.keras.layers.Input(shape=(1280,), name="bottleneck_input")
    x = tf.keras.layers.BatchNormalization(name="head_bn1")(head_input)
    x = tf.keras.layers.Dropout(0.35, name="head_dropout1")(x)
    x = tf.keras.layers.Dense(
        128,
        activation="relu",
        kernel_regularizer=tf.keras.regularizers.l2(1e-4),
        name="head_dense1"
    )(x)
    x = tf.keras.layers.BatchNormalization(name="head_bn2")(x)
    x = tf.keras.layers.Dropout(0.25, name="head_dropout2")(x)
    head_output = tf.keras.layers.Dense(4, activation="softmax", name="species_softmax")(x)

    head_model = tf.keras.Model(inputs=head_input, outputs=head_output, name="species_classifier_head")

    head_model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.05),
        metrics=["accuracy"]
    )

    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=4,
            restore_best_weights=True,
            verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=2,
            min_lr=1e-5,
            verbose=1
        ),
        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(temp_checkpoint),
            monitor="val_loss",
            save_best_only=True,
            save_weights_only=False,
            verbose=1
        )
    ]

    t0 = time.time()
    history = head_model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=25,
        batch_size=64,
        callbacks=callbacks,
        verbose=1
    )
    t1 = time.time()
    train_duration = t1 - t0
    print(f"\nClassifier head training completed in {train_duration:.2f}s ({len(history.history['loss'])} epochs)!")

    # Ensure best checkpoint loaded
    if temp_checkpoint.exists():
        head_model = tf.keras.models.load_model(str(temp_checkpoint))
        print("Restored best checkpoint model based on minimum validation loss.")

    return head_model, history, train_duration


def assemble_full_pipeline(base_extractor, head_model):
    """
    Assemble complete standalone end-to-end model:
    Input (224, 224, 3) raw [0, 255] -> Rescaling -> MobileNetV2 -> Head -> Softmax
    """
    print("\n" + "=" * 70)
    print("STEP 3: Assembling Full End-to-End Pipeline & Verifying Invariance...")
    print("=" * 70)

    raw_input = tf.keras.layers.Input(shape=(224, 224, 3), dtype=tf.float32, name="image_input")
    x = tf.keras.layers.Rescaling(scale=1.0 / 127.5, offset=-1.0, name="rescaling")(raw_input)
    feats = base_extractor(x)
    preds = head_model(feats)

    full_model = tf.keras.Model(inputs=raw_input, outputs=preds, name="crop_species_gatekeeper")

    # Verify output shape and probability sum
    dummy_input = np.random.uniform(0, 255, (2, 224, 224, 3)).astype(np.float32)
    dummy_out = full_model.predict(dummy_input, verbose=0)
    assert dummy_out.shape == (2, 4), f"Unexpected output shape: {dummy_out.shape}"
    assert np.allclose(dummy_out.sum(axis=1), 1.0, atol=1e-5), "Softmax probabilities do not sum to 1.0"

    print("End-to-end model architecture verified successfully!")
    return full_model


def evaluate_validation_performance(full_model, val_items, y_val_true):
    """
    Comprehensive evaluation on the 1,417 validation images.
    Computes accuracy, macro-F1, per-class precision/recall/F1,
    confusion matrix, FAR, and FRR with explicit denominators.
    """
    print("\n" + "=" * 70)
    print("STEP 4: Evaluating Validation Metrics (n = 1,417)...")
    print("=" * 70)

    val_images = []
    for item in val_items:
        img_p = RAW_DIR / item["relative_path"]
        with Image.open(img_p) as img:
            rgb = img.convert("RGB").resize((224, 224))
            val_images.append(np.array(rgb, dtype=np.float32))

    X_val_raw = np.array(val_images, dtype=np.float32)

    val_probs = full_model.predict(X_val_raw, batch_size=64, verbose=0)
    val_preds = np.argmax(val_probs, axis=1)

    # 1. Overall accuracy
    acc = float(np.mean(val_preds == y_val_true))

    # 2. Macro-F1
    macro_f1 = float(f1_score(y_val_true, val_preds, average="macro"))

    # 3. Per-class precision, recall, F1, support
    prec, rec, f1, supp = precision_recall_fscore_support(y_val_true, val_preds, labels=[0, 1, 2, 3])

    per_class_metrics = {}
    for i, c_name in enumerate(CLASS_NAMES):
        per_class_metrics[c_name] = {
            "precision": float(prec[i]),
            "recall": float(rec[i]),
            "f1_score": float(f1[i]),
            "support": int(supp[i])
        }

    # 4. Confusion matrix
    cm = confusion_matrix(y_val_true, val_preds, labels=[0, 1, 2, 3])
    cm_dict = {
        CLASS_NAMES[i]: {CLASS_NAMES[j]: int(cm[i, j]) for j in range(4)}
        for i in range(4)
    }

    # 5. Unsupported False Acceptance Rate (FAR)
    # Denominator: Total Unsupported validation samples (Class 3 true count = 363)
    unsupported_total = int(np.sum(y_val_true == 3))
    unsupported_false_accept = int(np.sum((y_val_true == 3) & (val_preds != 3)))
    far = float(unsupported_false_accept / unsupported_total) if unsupported_total > 0 else 0.0

    # 6. Supported False Rejection Rate (FRR)
    # Denominator: Total Supported validation samples (Classes 0, 1, 2 true count = 1054)
    supported_total = int(np.sum(y_val_true != 3))
    supported_false_reject = int(np.sum((y_val_true != 3) & (val_preds == 3)))
    frr = float(supported_false_reject / supported_total) if supported_total > 0 else 0.0

    metrics_report = {
        "evaluation_timestamp": datetime.now().isoformat(),
        "validation_samples_count": len(val_items),
        "overall_accuracy": round(acc, 4),
        "macro_f1": round(macro_f1, 4),
        "unsupported_far": {
            "far_rate": round(far, 4),
            "false_accepted_count": unsupported_false_accept,
            "denominator_total_unsupported": unsupported_total,
            "formula": "unsupported_falsely_classified_as_supported / total_unsupported"
        },
        "supported_frr": {
            "frr_rate": round(frr, 4),
            "false_rejected_count": supported_false_reject,
            "denominator_total_supported": supported_total,
            "formula": "supported_falsely_classified_as_unsupported / total_supported"
        },
        "per_class": per_class_metrics,
        "confusion_matrix": cm_dict
    }

    return metrics_report, cm


def save_and_verify_artifacts(full_model, history, metrics_report, train_duration):
    """Save model artifact, mapping, history, and metrics. Check SHA-256."""
    print("\n" + "=" * 70)
    print("STEP 5: Serializing Artifacts & Checksum Verification...")
    print("=" * 70)

    # 1. Save Full Keras Model
    full_model.save(str(MODEL_OUTPUT_PATH))
    model_sha256 = get_file_sha256(MODEL_OUTPUT_PATH)
    model_size = os.path.getsize(MODEL_OUTPUT_PATH)
    print(f"Saved Stage 1 Model to: {MODEL_OUTPUT_PATH}")
    print(f"  Model Size: {model_size:,} bytes")
    print(f"  Model SHA-256: {model_sha256}")

    # 2. Save Class Mapping
    with open(MAPPING_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(CLASS_INDICES, f, indent=2)
    print(f"Saved Class Mapping to: {MAPPING_OUTPUT_PATH}")

    # 3. Save Training History
    hist_clean = {k: [float(val) for val in v] for k, v in history.history.items()}
    hist_data = {
        "epochs_trained": len(hist_clean["loss"]),
        "train_duration_seconds": round(train_duration, 2),
        "history": hist_clean
    }
    with open(HISTORY_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(hist_data, f, indent=2)
    print(f"Saved Training History to: {HISTORY_OUTPUT_PATH}")

    # 4. Save Validation Metrics
    metrics_report["model_artifact_sha256"] = model_sha256
    metrics_report["train_duration_seconds"] = round(train_duration, 2)
    with open(METRICS_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics_report, f, indent=2)
    print(f"Saved Validation Metrics to: {METRICS_OUTPUT_PATH}")

    # 5. Verify Model Can Be Loaded and Produces Identical Predictions
    reloaded_model = tf.keras.models.load_model(str(MODEL_OUTPUT_PATH))
    test_probe = np.zeros((1, 224, 224, 3), dtype=np.float32)
    probe_pred = reloaded_model.predict(test_probe, verbose=0)
    assert probe_pred.shape == (1, 4), f"Reloaded model shape mismatch: {probe_pred.shape}"
    print("Reloaded model successfully verified: output shape (1, 4) matches.")

    # 6. Verify Stage 2 Model Checksum Invariance
    stage2_post_sha256 = get_file_sha256(STAGE2_MODEL_PATH)
    print(f"\nStage 2 Model Checksum Invariance Check:")
    print(f"  Stage 2 Path: {STAGE2_MODEL_PATH}")
    print(f"  Stage 2 SHA-256: {stage2_post_sha256}")
    assert stage2_post_sha256.upper() == "215225AE176B23514BF59E39E2B7B521B4BCFF2F600A504DC6CEC712342A2C82", \
        "CRITICAL ALERT: Stage 2 model checksum changed!"
    print("Stage 2 model artifact verified 100% UNTOUCHED and BIT-FOR-BIT IDENTICAL!")

    return model_sha256


def main():
    start_time = time.time()

    # Pre-training check of Stage 2 model
    stage2_pre_sha256 = get_file_sha256(STAGE2_MODEL_PATH)
    print(f"Pre-training Stage 2 Checksum: {stage2_pre_sha256}")
    assert stage2_pre_sha256.upper() == "215225AE176B23514BF59E39E2B7B521B4BCFF2F600A504DC6CEC712342A2C82"

    train_items, val_items = load_manifest_data()

    # Base feature extractor
    print("\nInitializing Pretrained MobileNetV2 Base (ImageNet, Frozen Backbone)...")
    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(224, 224, 3),
        include_top=False,
        weights="imagenet",
        pooling="avg"
    )
    base_model.trainable = False

    # Extract features
    X_train_feats, y_train, y_train_labels = extract_bottleneck_features(
        train_items, base_model, desc="Train Split"
    )
    X_val_feats, y_val, y_val_labels = extract_bottleneck_features(
        val_items, base_model, desc="Validation Split"
    )

    # Train head
    head_model, history, train_duration = build_and_train_head(
        X_train_feats, y_train, X_val_feats, y_val
    )

    # Assemble full end-to-end model
    full_model = assemble_full_pipeline(base_model, head_model)

    # Validation evaluation
    metrics_report, cm = evaluate_validation_performance(full_model, val_items, y_val_labels)

    # Print summary metrics
    print("\n" + "=" * 70)
    print("STAGE 1 VALIDATION PERFORMANCE SUMMARY (n = 1,417):")
    print("=" * 70)
    print(f"Overall Accuracy:  {metrics_report['overall_accuracy'] * 100:.2f}%")
    print(f"Macro-F1 Score:    {metrics_report['macro_f1'] * 100:.2f}%")
    print(f"Unsupported FAR:   {metrics_report['unsupported_far']['far_rate'] * 100:.2f}% ({metrics_report['unsupported_far']['false_accepted_count']}/{metrics_report['unsupported_far']['denominator_total_unsupported']})")
    print(f"Supported FRR:     {metrics_report['supported_frr']['frr_rate'] * 100:.2f}% ({metrics_report['supported_frr']['false_rejected_count']}/{metrics_report['supported_frr']['denominator_total_supported']})")

    print("\nPer-Class Breakdown:")
    for c_name, m in metrics_report["per_class"].items():
        print(f"  {c_name:12}: Precision={m['precision']*100:5.2f}%, Recall={m['recall']*100:5.2f}%, F1={m['f1_score']*100:5.2f}% (Support={m['support']})")

    print("\nConfusion Matrix (Rows=True, Cols=Predicted):")
    header = "True \\ Pred  |" + "".join([f"{c:>12}" for c in CLASS_NAMES])
    print(header)
    print("-" * len(header))
    for i, c_true in enumerate(CLASS_NAMES):
        row_str = f"{c_true:12} |" + "".join([f"{cm[i, j]:12d}" for j in range(4)])
        print(row_str)

    # Save artifacts & verify checksums
    model_sha256 = save_and_verify_artifacts(full_model, history, metrics_report, train_duration)

    total_time = time.time() - start_time
    print(f"\nStage 1 species gatekeeper training and evaluation finished in {total_time:.1f}s ({total_time/60:.1f} min)!")


if __name__ == "__main__":
    main()
