"""
TerraNex - Two-Stage Disease Detection Evaluation Script (Step 5)
Evaluates:
  1. Quarantined Test Split (n = 1,417 images, evaluated strictly once)
  2. Stage 2 Pathology & Safety Evaluation (including Potato___healthy blind spot)
  3. Real Out-of-Sample Unsupported Stress Cohort (n = 550 non-manifest images)
  4. Real Non-Leaf Visual Stress Cohort
  5. Synthetic Perturbation Stress Cohorts (clearly labeled)
Locked thresholds: tau_species = 0.60, tau_other = 0.20, delta_margin = 0.10.
"""

import os
import sys
import json
import time
import hashlib
import random
from pathlib import Path
from datetime import datetime
from collections import defaultdict
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
import tensorflow as tf
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support
)

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "plant_disease" / "raw" / "PlantVillage"
MANIFEST_PATH = PROJECT_ROOT / "data" / "plant_disease" / "splits" / "species_split_manifest_v1.json"
MODELS_DIR = PROJECT_ROOT / "models"
REPORTS_DIR = PROJECT_ROOT / "reports"

STAGE1_MODEL_PATH = MODELS_DIR / "crop_species_model_v1.0.keras"
STAGE2_MODEL_PATH = MODELS_DIR / "crop_disease_model.keras"
REPORT_OUTPUT_PATH = REPORTS_DIR / "two_stage_evaluation_report_v1.0.json"

CLASS_NAMES = ["Tomato", "Potato", "Bell Pepper", "Unsupported"]

STAGE2_CLASSES = [
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy"
]

STAGE2_GENUS_MAP = {
    0: "Tomato",
    1: "Tomato",
    2: "Tomato",
    3: "Tomato",
    4: "Potato",
    5: "Potato",
    6: "Bell Pepper",
    7: "Bell Pepper"
}

# Locked Stage 1 Thresholds
TAU_SPECIES = 0.60
TAU_OTHER = 0.20
DELTA_MARGIN = 0.10


def get_file_sha256(filepath):
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def apply_gatekeeper_decision(prob_vector):
    """
    Applies locked gatekeeper decision logic:
      1. Priority 1: Reject Unsupported if top1 is Unsupported OR P[Unsupported] >= 0.20
      2. Priority 2: Abstain Uncertain if max(P) < 0.60 OR Margin < 0.10
      3. Priority 3: Accept to Stage 2 with Top-1 species
    """
    sorted_idx = np.argsort(prob_vector)[::-1]
    top1_idx = int(sorted_idx[0])
    top2_idx = int(sorted_idx[1])
    top1_p = float(prob_vector[top1_idx])
    top2_p = float(prob_vector[top2_idx])
    margin = top1_p - top2_p
    p_other = float(prob_vector[3])

    if top1_idx == 3 or p_other >= TAU_OTHER:
        return "REJECT_UNSUPPORTED", 3, top1_p, margin, p_other
    elif top1_p < TAU_SPECIES or margin < DELTA_MARGIN:
        return "ABSTAIN_UNCERTAIN", -1, top1_p, margin, p_other
    else:
        return "ACCEPT_STAGE2", top1_idx, top1_p, margin, p_other


# =============================================================
# COHORT 1: QUARANTINED TEST SPLIT EVALUATION (n = 1,417)
# =============================================================
def evaluate_quarantined_test_split(stage1_model, stage2_model, manifest):
    """Evaluates the 1,417 manifest test images strictly once."""
    print("\n" + "=" * 70)
    print("COHORT 1: Quarantined Test Split Evaluation (n = 1,417)...")
    print("=" * 70)

    test_items = [it for it in manifest["images"] if it["split"] == "test"]
    assert len(test_items) == 1417, f"Expected 1,417 test items, got {len(test_items)}"

    t0 = time.time()
    images = []
    y_true = []
    for it in test_items:
        img_p = RAW_DIR / it["relative_path"]
        with Image.open(img_p) as img:
            rgb = img.convert("RGB").resize((224, 224))
            images.append(np.array(rgb, dtype=np.float32))
        y_true.append(it["species_index"])

    X_test = np.array(images, dtype=np.float32)
    y_true = np.array(y_true, dtype=np.int32)

    probs = stage1_model.predict(X_test, batch_size=64, verbose=0)
    t1 = time.time()
    print(f"Stage 1 predictions on test split computed in {t1 - t0:.2f}s!")

    # Raw argmax metrics
    raw_preds = np.argmax(probs, axis=1)
    raw_acc = float(np.mean(raw_preds == y_true))
    raw_macro_f1 = float(f1_score(y_true, raw_preds, average="macro"))

    # Gatekeeper policy evaluation
    actions = []
    pred_species = []
    decision_details = []

    for i in range(1417):
        act, sp, top_p, marg, p_oth = apply_gatekeeper_decision(probs[i])
        actions.append(act)
        pred_species.append(sp)
        decision_details.append({
            "item": test_items[i],
            "true_species": CLASS_NAMES[y_true[i]],
            "true_species_idx": int(y_true[i]),
            "action": act,
            "pred_species_idx": sp,
            "top1_prob": top_p,
            "margin": marg,
            "p_other": p_oth,
            "raw_top1_idx": int(raw_preds[i]),
            "raw_top1_name": CLASS_NAMES[raw_preds[i]]
        })

    actions = np.array(actions)
    pred_species = np.array(pred_species)

    # 1. Action Counts
    action_counts = {
        "ACCEPT_STAGE2": int(np.sum(actions == "ACCEPT_STAGE2")),
        "ABSTAIN_UNCERTAIN": int(np.sum(actions == "ABSTAIN_UNCERTAIN")),
        "REJECT_UNSUPPORTED": int(np.sum(actions == "REJECT_UNSUPPORTED")),
        "total": 1417
    }

    # 2. Unsupported FAR (Denominator = 363 total unsupported test images)
    unsupported_mask = (y_true == 3)
    unsupported_total = int(np.sum(unsupported_mask))
    unsupported_passed = int(np.sum(unsupported_mask & (actions == "ACCEPT_STAGE2")))
    far_rate = unsupported_passed / unsupported_total if unsupported_total > 0 else 0.0

    # 3. Supported FRR (Denominator = 1054 total supported test images)
    supported_mask = (y_true != 3)
    supported_total = int(np.sum(supported_mask))
    supported_blocked = int(np.sum(supported_mask & (actions != "ACCEPT_STAGE2")))
    supported_abstained = int(np.sum(supported_mask & (actions == "ABSTAIN_UNCERTAIN")))
    supported_falsely_rejected = int(np.sum(supported_mask & (actions == "REJECT_UNSUPPORTED")))
    frr_rate = supported_blocked / supported_total if supported_total > 0 else 0.0

    # 4. Species Accuracy Among Accepted Supported Leaves
    supported_passed = int(np.sum(supported_mask & (actions == "ACCEPT_STAGE2")))
    supported_passed_correct = int(np.sum(supported_mask & (actions == "ACCEPT_STAGE2") & (pred_species == y_true)))
    accepted_species_acc = supported_passed_correct / supported_passed if supported_passed > 0 else 1.0

    # 5. Per-class metrics (raw argmax)
    prec, rec, f1, supp = precision_recall_fscore_support(y_true, raw_preds, labels=[0, 1, 2, 3])
    cm = confusion_matrix(y_true, raw_preds, labels=[0, 1, 2, 3])

    per_class_metrics = {}
    for i, c_name in enumerate(CLASS_NAMES):
        per_class_metrics[c_name] = {
            "precision": round(float(prec[i]), 4),
            "recall": round(float(rec[i]), 4),
            "f1_score": round(float(f1[i]), 4),
            "support": int(supp[i])
        }

    cm_dict = {
        CLASS_NAMES[i]: {CLASS_NAMES[j]: int(cm[i, j]) for j in range(4)}
        for i in range(4)
    }

    # 6. Supported Species Breakdown
    supported_breakdown = {}
    for c_idx, c_name in enumerate(["Tomato", "Potato", "Bell Pepper"]):
        mask = (y_true == c_idx)
        tot = int(np.sum(mask))
        pas = int(np.sum(mask & (actions == "ACCEPT_STAGE2")))
        abs_cnt = int(np.sum(mask & (actions == "ABSTAIN_UNCERTAIN")))
        rej = int(np.sum(mask & (actions == "REJECT_UNSUPPORTED")))
        cor = int(np.sum(mask & (actions == "ACCEPT_STAGE2") & (pred_species == c_idx)))
        supported_breakdown[c_name] = {
            "total_test_samples": tot,
            "passed_to_stage2": pas,
            "abstained_uncertain": abs_cnt,
            "rejected_unsupported": rej,
            "correct_species_passed": cor,
            "accuracy_when_passed": round(cor / pas * 100, 2) if pas > 0 else 0.0
        }

    # 7. Unsupported Species Breakdown (All 11 species, each n = 33)
    unsupported_breakdown = {}
    unsupported_items = [decision_details[i] for i in range(1417) if y_true[i] == 3]
    by_source_species = defaultdict(list)
    for it in unsupported_items:
        src_cat = it["item"]["source_category"]
        sp_name = src_cat.split("___")[0]
        by_source_species[sp_name].append(it)

    for sp_name, items in sorted(by_source_species.items()):
        tot = len(items)
        passed_cnt = sum(1 for it in items if it["action"] == "ACCEPT_STAGE2")
        abstained_cnt = sum(1 for it in items if it["action"] == "ABSTAIN_UNCERTAIN")
        rejected_cnt = sum(1 for it in items if it["action"] == "REJECT_UNSUPPORTED")
        unsupported_breakdown[sp_name] = {
            "total_test_samples": tot,
            "rejected_as_unsupported": rejected_cnt,
            "abstained_as_uncertain": abstained_cnt,
            "falsely_passed_to_stage2": passed_cnt,
            "rejection_rate_percentage": round((rejected_cnt + abstained_cnt) / tot * 100, 2)
        }

    cohort1_report = {
        "cohort_name": "Quarantined Manifest Test Split",
        "sample_size": 1417,
        "raw_gatekeeper_accuracy": round(raw_acc, 4),
        "raw_macro_f1": round(raw_macro_f1, 4),
        "unsupported_far": {
            "rate": round(far_rate, 4),
            "percentage": round(far_rate * 100, 2),
            "numerator_false_passed": unsupported_passed,
            "denominator_total_unsupported": unsupported_total,
            "target": "<= 5.0%"
        },
        "supported_frr": {
            "rate": round(frr_rate, 4),
            "percentage": round(frr_rate * 100, 2),
            "numerator_blocked": supported_blocked,
            "falsely_rejected_as_unsupported": supported_falsely_rejected,
            "abstained_as_uncertain": supported_abstained,
            "denominator_total_supported": supported_total,
            "target": "<= 3.0%"
        },
        "accepted_supported_species_accuracy": {
            "percentage": round(accepted_species_acc * 100, 2),
            "numerator_correct_species": supported_passed_correct,
            "denominator_total_passed": supported_passed
        },
        "action_distribution": action_counts,
        "per_class_metrics": per_class_metrics,
        "confusion_matrix": cm_dict,
        "supported_breakdown": supported_breakdown,
        "unsupported_species_breakdown": unsupported_breakdown
    }

    return cohort1_report, decision_details, X_test


# =============================================================
# COHORT 2: STAGE 2 SAFETY & PATHOLOGY EVALUATION ON TEST IMAGES
# =============================================================
def evaluate_stage2_safety(stage2_model, decision_details, X_test):
    """
    Evaluates Stage 2 pathology model on test images passed by Stage 1.
    Specifically isolates Potato___healthy test cohort (n = 23).
    """
    print("\n" + "=" * 70)
    print("STAGE 2 SAFETY EVALUATION: Accepted Test Foliage & Healthy Potato Gap...")
    print("=" * 70)

    # 1. Evaluate Stage 2 on ALL supported test images passed to Stage 2
    passed_indices = [i for i, d in enumerate(decision_details) if d["action"] == "ACCEPT_STAGE2" and d["true_species_idx"] != 3]
    print(f"Total accepted supported test images evaluated by Stage 2: {len(passed_indices)}")

    passed_X = X_test[passed_indices]
    stage2_probs = stage2_model.predict(passed_X, batch_size=64, verbose=0)

    stage2_evaluations = []
    discrepancy_count = 0

    for idx_local, idx_global in enumerate(passed_indices):
        d = decision_details[idx_global]
        p2 = stage2_probs[idx_local]
        top_disease_idx = int(np.argmax(p2))
        top_disease_p = float(p2[top_disease_idx])
        top_disease_name = STAGE2_CLASSES[top_disease_idx]
        stage2_genus = STAGE2_GENUS_MAP[top_disease_idx]
        stage1_genus = CLASS_NAMES[d["pred_species_idx"]]

        # Cross-stage consistency check
        is_consistent = (stage1_genus == stage2_genus)
        if not is_consistent:
            discrepancy_count += 1

        source_category = d["item"]["source_category"]

        stage2_evaluations.append({
            "relative_path": d["item"]["relative_path"],
            "source_category": source_category,
            "true_species": d["true_species"],
            "stage1_predicted_species": stage1_genus,
            "stage2_predicted_disease": top_disease_name,
            "stage2_confidence": round(top_disease_p * 100, 2),
            "stage2_predicted_genus": stage2_genus,
            "cross_stage_consistent": is_consistent
        })

    # 2. Dedicated Analysis of Healthy Potato Test Cohort (n = 23)
    healthy_potato_test = [d for d in decision_details if d["item"]["source_category"] == "Potato___healthy"]
    print(f"\nEvaluating Healthy Potato Test Cohort (n = {len(healthy_potato_test)} images)...")
    assert len(healthy_potato_test) == 23, f"Expected 23 healthy potato test images, got {len(healthy_potato_test)}"

    hp_passed = [d for d in healthy_potato_test if d["action"] == "ACCEPT_STAGE2"]
    hp_abstained = [d for d in healthy_potato_test if d["action"] == "ABSTAIN_UNCERTAIN"]
    hp_rejected = [d for d in healthy_potato_test if d["action"] == "REJECT_UNSUPPORTED"]

    # Run Stage 2 on the healthy potato images
    hp_stage2_diagnoses = defaultdict(int)
    for d in hp_passed:
        img_p = RAW_DIR / d["item"]["relative_path"]
        with Image.open(img_p) as img:
            rgb = img.convert("RGB").resize((224, 224))
            arr = np.expand_dims(np.array(rgb, dtype=np.float32), axis=0)
        p2 = stage2_model.predict(arr, verbose=0)[0]
        top_idx = int(np.argmax(p2))
        top_disease = STAGE2_CLASSES[top_idx]
        hp_stage2_diagnoses[top_disease] += 1

    print("Stage 2 Forced-Choice Diagnoses on Healthy Potato Test Leaves:")
    for dis, cnt in hp_stage2_diagnoses.items():
        print(f"  {dis}: {cnt} leaves")

    stage2_safety_report = {
        "total_accepted_supported_images_evaluated": len(passed_indices),
        "cross_stage_consistency": {
            "consistent_count": len(passed_indices) - discrepancy_count,
            "discrepancy_count": discrepancy_count,
            "discrepancy_percentage": round(discrepancy_count / len(passed_indices) * 100, 2)
        },
        "healthy_potato_blind_spot_evaluation": {
            "total_healthy_potato_test_samples": 23,
            "stage1_passed_to_stage2": len(hp_passed),
            "stage1_abstained_as_uncertain": len(hp_abstained),
            "stage1_rejected_as_unsupported": len(hp_rejected),
            "stage2_forced_choice_diagnoses": dict(hp_stage2_diagnoses),
            "safety_assessment": (
                "CONFIRMED: Stage 2 lacks Potato___healthy. All accepted healthy potato leaves "
                "are forced into foliar blight categories or cross-species classes. Automated fungicide "
                "advice must be STRICTLY SUPPRESSED unless visual symptoms are confirmed by the user."
            )
        }
    }

    return stage2_safety_report


# =============================================================
# COHORT 3: REAL OUT-OF-SAMPLE UNSUPPORTED STRESS COHORT
# =============================================================
def evaluate_real_unsupported_stress_cohort(stage1_model, manifest):
    """
    Evaluates real, untouched images from PlantVillage unsupported species
    that were NEVER included in the manifest (neither train, val, nor test).
    Samples 550 real images (50 per species across 11 unsupported species).
    """
    print("\n" + "=" * 70)
    print("COHORT 2: Real Out-of-Sample Unsupported Stress Cohort (n = 550)...")
    print("=" * 70)

    # Collect all manifest relative paths
    manifest_paths = {it["relative_path"] for it in manifest["images"]}

    # Scan raw PlantVillage for unused unsupported images
    unused_by_species = defaultdict(list)
    for cat_dir in sorted((RAW_DIR / "train").iterdir()) + sorted((RAW_DIR / "val").iterdir()):
        if not cat_dir.is_dir():
            continue
        c_name = cat_dir.name
        if not (c_name.startswith("Tomato") or c_name.startswith("Potato") or "Pepper" in c_name or "pepper" in c_name):
            sp_name = c_name.split("___")[0]
            for img_f in cat_dir.iterdir():
                if not img_f.is_file():
                    continue
                rel_p = str(img_f.relative_to(RAW_DIR)).replace("\\", "/")
                if rel_p not in manifest_paths:
                    unused_by_species[sp_name].append(img_f)

    print("Unused real unsupported pools available on disk:")
    sample_stress_paths = []
    for sp, flist in sorted(unused_by_species.items()):
        print(f"  {sp:15}: {len(flist)} available")
        random.seed(SEED)
        sampled = random.sample(flist, min(50, len(flist)))
        sample_stress_paths.extend([(sp, p) for p in sampled])

    print(f"\nEvaluating {len(sample_stress_paths)} real untouched unsupported images...")
    images = []
    sp_labels = []
    for sp, p in sample_stress_paths:
        with Image.open(p) as img:
            rgb = img.convert("RGB").resize((224, 224))
            images.append(np.array(rgb, dtype=np.float32))
        sp_labels.append(sp)

    X_stress = np.array(images, dtype=np.float32)
    probs = stage1_model.predict(X_stress, batch_size=64, verbose=0)

    passed_to_stage2 = 0
    rejected_unsupported = 0
    abstained_uncertain = 0

    per_species_res = defaultdict(lambda: {"total": 0, "rejected": 0, "abstained": 0, "falsely_passed": 0})

    for idx in range(len(sample_stress_paths)):
        sp = sp_labels[idx]
        act, _, _, _, _ = apply_gatekeeper_decision(probs[idx])
        per_species_res[sp]["total"] += 1

        if act == "ACCEPT_STAGE2":
            passed_to_stage2 += 1
            per_species_res[sp]["falsely_passed"] += 1
        elif act == "ABSTAIN_UNCERTAIN":
            abstained_uncertain += 1
            per_species_res[sp]["abstained"] += 1
        else:
            rejected_unsupported += 1
            per_species_res[sp]["rejected"] += 1

    total_stress = len(sample_stress_paths)
    far_stress = passed_to_stage2 / total_stress if total_stress > 0 else 0.0
    safe_rejection_rate = (rejected_unsupported + abstained_uncertain) / total_stress * 100

    print(f"Real Unsupported Stress Cohort Rejection Rate: {safe_rejection_rate:.2f}%")
    print(f"Real Unsupported Stress Cohort FAR: {far_stress * 100:.2f}% ({passed_to_stage2}/{total_stress})")

    cohort2_report = {
        "cohort_name": "Real Out-of-Sample Unsupported Stress Cohort (Non-Manifest Pool)",
        "provenance": "Unused PlantVillage images not included in train/val/test splits",
        "sample_size": total_stress,
        "unsupported_far": {
            "rate": round(far_stress, 4),
            "percentage": round(far_stress * 100, 2),
            "numerator_false_passed": passed_to_stage2,
            "denominator_total": total_stress
        },
        "safe_interception_rate_percentage": round(safe_rejection_rate, 2),
        "actions": {
            "rejected_as_unsupported": rejected_unsupported,
            "abstained_as_uncertain": abstained_uncertain,
            "falsely_passed_to_stage2": passed_to_stage2
        },
        "per_species_breakdown": dict(per_species_res)
    }

    return cohort2_report


# =============================================================
# COHORT 4: REAL NON-LEAF VISUAL STRESS COHORT
# =============================================================
def evaluate_real_non_leaf_cohort(stage1_model):
    """Evaluates available real non-foliar photographs."""
    print("\n" + "=" * 70)
    print("COHORT 3: Real Non-Leaf Visual Stress Cohort...")
    print("=" * 70)

    # Locate non-leaf sample images
    candidate_non_leaf = [
        PROJECT_ROOT / "backend" / ".venv" / "Lib" / "site-packages" / "sklearn" / "datasets" / "images" / "china.jpg",
        PROJECT_ROOT / "backend" / ".venv" / "Lib" / "site-packages" / "sklearn" / "datasets" / "images" / "flower.jpg"
    ]

    non_leaf_results = []
    for p in candidate_non_leaf:
        if not p.is_file():
            continue
        with Image.open(p) as img:
            rgb = img.convert("RGB").resize((224, 224))
            arr = np.expand_dims(np.array(rgb, dtype=np.float32), axis=0)

        p1 = stage1_model.predict(arr, verbose=0)[0]
        act, sp, top_p, marg, p_oth = apply_gatekeeper_decision(p1)
        non_leaf_results.append({
            "image_name": p.name,
            "path": str(p.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "action": act,
            "predicted_species": CLASS_NAMES[sp] if sp >= 0 else "None",
            "top1_prob": round(top_p * 100, 2),
            "margin": round(marg * 100, 2),
            "p_other": round(p_oth * 100, 2)
        })
        print(f"  {p.name}: Action = {act} (P_other = {p_oth*100:.2f}%, Top-1 = {top_p*100:.2f}%)")

    cohort3_report = {
        "cohort_name": "Real Non-Leaf Visual Stress Cohort",
        "sample_size": len(non_leaf_results),
        "results": non_leaf_results,
        "limitation_note": (
            "Only standard sample non-leaf photographs available locally. Complex natural open-world "
            "non-foliar images require expanded open-world training data."
        )
    }

    return cohort3_report


# =============================================================
# COHORT 5: SYNTHETIC PERTURBATION STRESS TESTS
# =============================================================
def evaluate_synthetic_perturbation_cohort(stage1_model, decision_details):
    """
    Evaluates controlled synthetic transformations on a sample of 200 test images.
    Clearly designated as synthetic stress tests.
    """
    print("\n" + "=" * 70)
    print("COHORT 4: Synthetic Perturbation Stress Tests (n = 200 images x 3 transforms)...")
    print("=" * 70)

    # Sample 200 test items
    random.seed(SEED)
    sample_details = random.sample(decision_details, 200)

    transforms = ["gaussian_blur", "severe_underexposure", "severe_overexposure"]
    results_by_transform = {}

    for t_type in transforms:
        perturbed_images = []
        y_true = []

        for d in sample_details:
            img_p = RAW_DIR / d["item"]["relative_path"]
            with Image.open(img_p) as img:
                rgb = img.convert("RGB").resize((224, 224))
                if t_type == "gaussian_blur":
                    rgb = rgb.filter(ImageFilter.GaussianBlur(radius=3.0))
                elif t_type == "severe_underexposure":
                    enhancer = ImageEnhance.Brightness(rgb)
                    rgb = enhancer.enhance(0.35)
                elif t_type == "severe_overexposure":
                    enhancer = ImageEnhance.Brightness(rgb)
                    rgb = enhancer.enhance(1.80)
                perturbed_images.append(np.array(rgb, dtype=np.float32))
            y_true.append(d["true_species_idx"])

        X_pert = np.array(perturbed_images, dtype=np.float32)
        probs = stage1_model.predict(X_pert, batch_size=64, verbose=0)

        acts = [apply_gatekeeper_decision(p)[0] for p in probs]
        action_counts = {
            "ACCEPT_STAGE2": acts.count("ACCEPT_STAGE2"),
            "ABSTAIN_UNCERTAIN": acts.count("ABSTAIN_UNCERTAIN"),
            "REJECT_UNSUPPORTED": acts.count("REJECT_UNSUPPORTED"),
            "total": len(acts)
        }

        # Check how many supported were abstained due to synthetic degradation
        supported_cnt = sum(1 for y in y_true if y != 3)
        supported_abstained = sum(1 for i, y in enumerate(y_true) if y != 3 and acts[i] == "ABSTAIN_UNCERTAIN")

        results_by_transform[t_type] = {
            "sample_size": len(acts),
            "action_counts": action_counts,
            "supported_abstention_rate_percentage": round(supported_abstained / supported_cnt * 100, 2) if supported_cnt > 0 else 0.0
        }
        print(f"  Transform '{t_type}': Abstain/Reject Rate = {(acts.count('ABSTAIN_UNCERTAIN') + acts.count('REJECT_UNSUPPORTED')) / len(acts) * 100:.2f}%")

    cohort4_report = {
        "cohort_name": "Synthetic Perturbation Stress Cohort",
        "description": "Controlled digital perturbations on 200 manifest test images to evaluate degradation resilience",
        "transforms": results_by_transform
    }

    return cohort4_report


# =============================================================
# MAIN ORCHESTRATION
# =============================================================
def main():
    start_time = time.time()
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Pre-evaluation checksum verification
    s1_pre_sha256 = get_file_sha256(STAGE1_MODEL_PATH)
    s2_pre_sha256 = get_file_sha256(STAGE2_MODEL_PATH)
    print(f"Pre-Eval Stage 1 SHA-256: {s1_pre_sha256}")
    print(f"Pre-Eval Stage 2 SHA-256: {s2_pre_sha256}")

    # 2. Load Manifest & Models
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    print("\nLoading models for evaluation...")
    stage1_model = tf.keras.models.load_model(str(STAGE1_MODEL_PATH))
    stage2_model = tf.keras.models.load_model(str(STAGE2_MODEL_PATH))

    # 3. Cohort 1: Quarantined Manifest Test Split
    cohort1_report, decision_details, X_test = evaluate_quarantined_test_split(
        stage1_model, stage2_model, manifest
    )

    # 4. Stage 2 Safety & Healthy Potato Evaluation
    stage2_safety_report = evaluate_stage2_safety(
        stage2_model, decision_details, X_test
    )

    # 5. Cohort 2: Real Out-of-Sample Unsupported Stress Cohort
    cohort2_report = evaluate_real_unsupported_stress_cohort(
        stage1_model, manifest
    )

    # 6. Cohort 3: Real Non-Leaf Visual Stress Cohort
    cohort3_report = evaluate_real_non_leaf_cohort(
        stage1_model
    )

    # 7. Cohort 4: Synthetic Perturbation Stress Tests
    cohort4_report = evaluate_synthetic_perturbation_cohort(
        stage1_model, decision_details
    )

    # 8. Open-world crops not in dataset status
    unfamiliar_open_world_status = {
        "cohort_name": "Unfamiliar Open-World Crops (Rice, Wheat, Cotton, Tea, Sugarcane)",
        "status": "NOT EVALUATED",
        "rationale": (
            "No real-world image datasets for these non-PlantVillage agricultural crops exist "
            "on the local system. In accordance with safety protocol, no synthetic data was fabricated."
        )
    }

    # 9. Post-evaluation checksum verification
    s1_post_sha256 = get_file_sha256(STAGE1_MODEL_PATH)
    s2_post_sha256 = get_file_sha256(STAGE2_MODEL_PATH)
    assert s1_pre_sha256 == s1_post_sha256, "Stage 1 model checksum changed during evaluation!"
    assert s2_pre_sha256 == s2_post_sha256, "Stage 2 model checksum changed during evaluation!"

    # 10. Assemble and serialize final evaluation report
    full_report = {
        "report_metadata": {
            "report_title": "TerraNex Two-Stage Disease Detection Evaluation Report",
            "version": "v1.0",
            "timestamp": datetime.now().isoformat(),
            "evaluation_duration_seconds": round(time.time() - start_time, 2),
            "stage1_model_path": str(STAGE1_MODEL_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "stage1_model_sha256": s1_post_sha256,
            "stage2_model_path": str(STAGE2_MODEL_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "stage2_model_sha256": s2_post_sha256,
            "locked_thresholds": {
                "tau_species": TAU_SPECIES,
                "tau_other": TAU_OTHER,
                "delta_margin": DELTA_MARGIN
            }
        },
        "cohort_1_quarantined_test_split": cohort1_report,
        "stage_2_safety_evaluation": stage2_safety_report,
        "cohort_2_real_unsupported_stress_cohort": cohort2_report,
        "cohort_3_real_non_leaf_stress_cohort": cohort3_report,
        "cohort_4_synthetic_perturbation_cohort": cohort4_report,
        "cohort_5_unfamiliar_open_world_crops": unfamiliar_open_world_status
    }

    with open(REPORT_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(full_report, f, indent=2)

    print(f"\nFinal evaluation report serialized to: {REPORT_OUTPUT_PATH}")
    print(f"Report file size: {os.path.getsize(REPORT_OUTPUT_PATH):,} bytes")
    print("\nStep 5 evaluation finished successfully with zero errors!")


if __name__ == "__main__":
    main()
