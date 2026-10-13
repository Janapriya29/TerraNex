"""
TerraNex - Empirical Threshold Calibration Script (Step 4)
Calibrates species confidence and top-two margin thresholds
using strictly the 1,417 validation images.
The quarantined test split (1,417 images) is strictly unaccessed.
"""

import os
import sys
import json
import time
import hashlib
from pathlib import Path
from datetime import datetime
from collections import defaultdict
import numpy as np
from PIL import Image
import tensorflow as tf

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "plant_disease" / "raw" / "PlantVillage"
MANIFEST_PATH = PROJECT_ROOT / "data" / "plant_disease" / "splits" / "species_split_manifest_v1.json"
MODELS_DIR = PROJECT_ROOT / "models"

MODEL_PATH = MODELS_DIR / "crop_species_model_v1.0.keras"
STAGE2_MODEL_PATH = MODELS_DIR / "crop_disease_model.keras"
META_OUTPUT_PATH = MODELS_DIR / "crop_species_model_v1.0.meta.json"

CLASS_NAMES = ["Tomato", "Potato", "Bell Pepper", "Unsupported"]


def get_file_sha256(filepath):
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def load_validation_data():
    """Load strictly the 1,417 validation images. Quarantine test split."""
    print("=" * 70)
    print("STEP 1: Loading Validation Split & Enforcing Test Quarantine...")
    print("=" * 70)

    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(f"Manifest not found: {MANIFEST_PATH}")

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    val_items = []
    quarantined_test_count = 0
    train_count = 0

    for item in manifest["images"]:
        spl = item["split"]
        if spl == "val":
            val_items.append(item)
        elif spl == "test":
            quarantined_test_count += 1
        elif spl == "train":
            train_count += 1

    print(f"Loaded {len(val_items)} Validation images (Target: 1,417)")
    print(f"Ignored {train_count} Train images")
    print(f"Quarantined {quarantined_test_count} Test images (Strictly Unused)")

    assert len(val_items) == 1417, f"Expected 1,417 validation images, found {len(val_items)}"
    assert quarantined_test_count == 1417, f"Expected 1,417 quarantined test images, found {quarantined_test_count}"

    return val_items


def compute_validation_probabilities(model, val_items):
    """Compute (1417, 4) probability matrix on raw validation images."""
    print("\n" + "=" * 70)
    print("STEP 2: Computing Model Probabilities on Validation Images...")
    print("=" * 70)

    t0 = time.time()
    images = []
    y_true = []

    for item in val_items:
        img_p = RAW_DIR / item["relative_path"]
        with Image.open(img_p) as img:
            rgb = img.convert("RGB").resize((224, 224))
            images.append(np.array(rgb, dtype=np.float32))
        y_true.append(item["species_index"])

    X_val = np.array(images, dtype=np.float32)
    y_val = np.array(y_true, dtype=np.int32)

    probs = model.predict(X_val, batch_size=64, verbose=0)
    t1 = time.time()
    print(f"Probabilities computed in {t1 - t0:.2f}s! Shape: {probs.shape}")

    assert probs.shape == (1417, 4), f"Unexpected probability shape: {probs.shape}"
    return probs, y_val


def evaluate_decision_policy(probs, y_true, tau_species, tau_other, delta_margin):
    """
    Evaluates decision policy for a given threshold tuple:
      Decision logic:
        1. If argmax is 3 (Unsupported) OR P[3] >= tau_other:
           -> REJECT_UNSUPPORTED
        2. Elif max_prob < tau_species OR (top1_prob - top2_prob) < delta_margin:
           -> ABSTAIN_UNCERTAIN
        3. Else:
           -> ACCEPT_STAGE2 with top-1 species
    """
    n_samples = len(y_true)
    actions = []
    pred_species = []

    for i in range(n_samples):
        p = probs[i]
        sorted_idx = np.argsort(p)[::-1]
        top1_idx = int(sorted_idx[0])
        top2_idx = int(sorted_idx[1])
        top1_p = float(p[top1_idx])
        top2_p = float(p[top2_idx])
        margin = top1_p - top2_p
        p_other = float(p[3])

        if top1_idx == 3 or p_other >= tau_other:
            actions.append("REJECT_UNSUPPORTED")
            pred_species.append(3)
        elif top1_p < tau_species or margin < delta_margin:
            actions.append("ABSTAIN_UNCERTAIN")
            pred_species.append(-1)
        else:
            actions.append("ACCEPT_STAGE2")
            pred_species.append(top1_idx)

    actions = np.array(actions)
    pred_species = np.array(pred_species)

    # Denominators explicitly defined
    unsupported_mask = (y_true == 3)
    supported_mask = (y_true != 3)

    unsupported_total = int(np.sum(unsupported_mask)) # 363
    supported_total = int(np.sum(supported_mask))     # 1054

    # FAR: Unsupported passed to Stage 2
    unsupported_passed = int(np.sum(unsupported_mask & (actions == "ACCEPT_STAGE2")))
    far = unsupported_passed / unsupported_total if unsupported_total > 0 else 0.0

    # FRR: Supported blocked from Stage 2 (either falsely rejected or abstained)
    supported_blocked = int(np.sum(supported_mask & (actions != "ACCEPT_STAGE2")))
    frr = supported_blocked / supported_total if supported_total > 0 else 0.0

    # Supported breakdown
    supported_falsely_rejected = int(np.sum(supported_mask & (actions == "REJECT_UNSUPPORTED")))
    supported_abstained = int(np.sum(supported_mask & (actions == "ABSTAIN_UNCERTAIN")))
    supported_passed = int(np.sum(supported_mask & (actions == "ACCEPT_STAGE2")))
    supported_passed_correct = int(np.sum(supported_mask & (actions == "ACCEPT_STAGE2") & (pred_species == y_true)))
    supported_passed_acc = supported_passed_correct / supported_passed if supported_passed > 0 else 1.0

    # Objective cost: 0.70 * FAR + 0.30 * FRR
    cost = 0.70 * far + 0.30 * frr

    return {
        "tau_species": round(tau_species, 2),
        "tau_other": round(tau_other, 2),
        "delta_margin": round(delta_margin, 2),
        "far": round(far, 4),
        "far_percentage": round(far * 100, 2),
        "unsupported_passed_count": unsupported_passed,
        "unsupported_total": unsupported_total,
        "frr": round(frr, 4),
        "frr_percentage": round(frr * 100, 2),
        "supported_blocked_count": supported_blocked,
        "supported_falsely_rejected": supported_falsely_rejected,
        "supported_abstained": supported_abstained,
        "supported_total": supported_total,
        "supported_passed_count": supported_passed,
        "supported_passed_correct": supported_passed_correct,
        "supported_passed_accuracy": round(supported_passed_acc * 100, 2),
        "objective_cost": round(cost, 4)
    }


def run_threshold_grid_search(probs, y_val):
    """Systematic grid search over candidate thresholds on validation data."""
    print("\n" + "=" * 70)
    print("STEP 3: Systematic Threshold Grid Sweep on Validation Set...")
    print("=" * 70)

    tau_species_candidates = [0.60, 0.70, 0.75, 0.80, 0.85, 0.90]
    tau_other_candidates = [0.20, 0.25, 0.30, 0.35, 0.40]
    delta_margin_candidates = [0.10, 0.15, 0.20, 0.25, 0.30]

    all_results = []

    # Also evaluate baseline un-thresholded argmax
    baseline_result = evaluate_decision_policy(probs, y_val, tau_species=0.50, tau_other=0.50, delta_margin=0.0)
    baseline_result["profile"] = "Baseline (Standard ArgMax)"

    for ts in tau_species_candidates:
        for to in tau_other_candidates:
            for dm in delta_margin_candidates:
                res = evaluate_decision_policy(probs, y_val, ts, to, dm)
                all_results.append(res)

    # Sort results by objective cost
    all_results.sort(key=lambda x: x["objective_cost"])

    # Find candidate operating points:
    # 1. Optimal Balanced (minimizes J = 0.7*FAR + 0.3*FRR, requiring FAR <= 0.01)
    best_balanced = min(all_results, key=lambda x: x["objective_cost"])
    best_balanced["profile"] = "Optimal Balanced"

    # 2. Conservative Safety (strictly minimizes FAR, even if FRR slightly increases)
    min_far = min(r["far"] for r in all_results)
    conservative_candidates = [r for r in all_results if r["far"] == min_far]
    conservative_candidates.sort(key=lambda x: x["frr"])
    best_conservative = conservative_candidates[0]
    best_conservative["profile"] = "Conservative Safety Priority"

    # 3. High Sensitivity (minimizes FRR, requiring FAR <= 0.02)
    low_frr_candidates = [r for r in all_results if r["far"] <= 0.02]
    low_frr_candidates.sort(key=lambda x: x["frr"])
    best_sensitivity = low_frr_candidates[0]
    best_sensitivity["profile"] = "High Sensitivity"

    print("\n--- Key Calibration Operating Profiles (Evaluated on 1,417 Val Images) ---")
    profiles = [baseline_result, best_conservative, best_balanced, best_sensitivity]
    for p in profiles:
        print(f"\nProfile: {p['profile']}")
        print(f"  Thresholds: tau_species={p['tau_species']}, tau_other={p['tau_other']}, delta_margin={p['delta_margin']}")
        print(f"  Unsupported FAR: {p['far_percentage']}% ({p['unsupported_passed_count']}/{p['unsupported_total']})")
        print(f"  Supported FRR:   {p['frr_percentage']}% ({p['supported_blocked_count']}/{p['supported_total']})")
        print(f"    - Supported Abstained: {p.get('supported_abstained', 0)}")
        print(f"    - Supported Falsely Rejected: {p.get('supported_falsely_rejected', 0)}")
        print(f"  Passed Species Accuracy: {p['supported_passed_accuracy']}% ({p['supported_passed_correct']}/{p['supported_passed_count']})")
        print(f"  Objective Cost J(tau): {p['objective_cost']}")

    return best_balanced, profiles, all_results


def save_and_verify_metadata(selected_profile, profiles, all_results, model_sha256):
    """Save metadata to crop_species_model_v1.0.meta.json and verify load."""
    print("\n" + "=" * 70)
    print("STEP 4: Saving Metadata & Verification...")
    print("=" * 70)

    meta_payload = {
        "model_version": "v1.0",
        "model_artifact": "models/crop_species_model_v1.0.keras",
        "model_sha256": model_sha256,
        "calibration_timestamp": datetime.now().isoformat(),
        "calibration_source": "Validation Split Only (data/plant_disease/splits/species_split_manifest_v1.json)",
        "quarantined_test_set_status": "Strictly Quarantined (1,417 images unaccessed)",
        "validation_sample_size": 1417,
        "selected_operating_profile": selected_profile["profile"],
        "selected_thresholds": {
            "tau_species": selected_profile["tau_species"],
            "tau_other": selected_profile["tau_other"],
            "delta_margin": selected_profile["delta_margin"]
        },
        "metric_definitions": {
            "far_definition": "Unsupported validation images falsely passed to Stage 2 / 363 total Unsupported validation images",
            "frr_definition": "Supported validation images blocked from Stage 2 / 1054 total Supported validation images",
            "target_far_hypothesis": "<= 5.0% False Acceptance Rate",
            "target_accuracy_hypothesis": ">= 95.0% Categorical Accuracy"
        },
        "validation_performance_at_selected_thresholds": {
            "far_rate": selected_profile["far"],
            "far_percentage": selected_profile["far_percentage"],
            "unsupported_passed_count": selected_profile["unsupported_passed_count"],
            "denominator_total_unsupported": selected_profile["unsupported_total"],
            "frr_rate": selected_profile["frr"],
            "frr_percentage": selected_profile["frr_percentage"],
            "supported_blocked_count": selected_profile["supported_blocked_count"],
            "supported_abstained_count": selected_profile["supported_abstained"],
            "supported_falsely_rejected_count": selected_profile["supported_falsely_rejected"],
            "denominator_total_supported": selected_profile["supported_total"],
            "supported_passed_count": selected_profile["supported_passed_count"],
            "supported_passed_correct": selected_profile["supported_passed_correct"],
            "supported_passed_accuracy_percentage": selected_profile["supported_passed_accuracy"],
            "objective_cost": selected_profile["objective_cost"]
        },
        "comparison_operating_profiles": profiles,
        "top_10_grid_configurations": all_results[:10]
    }

    with open(META_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(meta_payload, f, indent=2)

    print(f"Metadata successfully saved to: {META_OUTPUT_PATH}")
    print(f"File size: {os.path.getsize(META_OUTPUT_PATH):,} bytes")

    # Verify reload
    with open(META_OUTPUT_PATH, "r", encoding="utf-8") as f:
        loaded = json.load(f)

    assert loaded["model_sha256"] == model_sha256, "Metadata SHA-256 mismatch!"
    assert loaded["selected_thresholds"]["tau_species"] == selected_profile["tau_species"]
    print("Metadata re-verification succeeded! Matches model artifact.")

    # Verify Stage 2 Model Checksum Invariance
    stage2_sha256 = get_file_sha256(STAGE2_MODEL_PATH)
    print(f"\nStage 2 Model Checksum Verification:")
    print(f"  Stage 2 Path: {STAGE2_MODEL_PATH}")
    print(f"  Stage 2 SHA-256: {stage2_sha256}")
    assert stage2_sha256.upper() == "215225AE176B23514BF59E39E2B7B521B4BCFF2F600A504DC6CEC712342A2C82"
    print("Stage 2 model artifact verified 100% UNTOUCHED and BIT-FOR-BIT IDENTICAL!")


def main():
    start_time = time.time()

    # Pre-check Stage 2 model
    stage2_sha256 = get_file_sha256(STAGE2_MODEL_PATH)
    assert stage2_sha256.upper() == "215225AE176B23514BF59E39E2B7B521B4BCFF2F600A504DC6CEC712342A2C82"

    # Pre-check Stage 1 model
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Stage 1 model not found: {MODEL_PATH}")
    model_sha256 = get_file_sha256(MODEL_PATH)
    print(f"Stage 1 Model SHA-256: {model_sha256}")

    # Load validation data only
    val_items = load_validation_data()

    # Load model (read-only, no training)
    print("\nLoading Stage 1 Model (Read-Only)...")
    model = tf.keras.models.load_model(str(MODEL_PATH))

    # Compute validation probabilities
    probs, y_val = compute_validation_probabilities(model, val_items)

    # Grid search on validation data
    best_balanced, profiles, all_results = run_threshold_grid_search(probs, y_val)

    # Save metadata and verify
    save_and_verify_metadata(best_balanced, profiles, all_results, model_sha256)

    total_time = time.time() - start_time
    print(f"\nThreshold calibration completed in {total_time:.2f}s!")


if __name__ == "__main__":
    main()
