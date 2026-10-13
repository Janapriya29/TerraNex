"""
TerraNex - Plant Disease Gatekeeper Dataset Manifest Generator
Generates a content-hash deduplicated, balanced 4-way species manifest (9,447 images)
Splits: 70% Train (6,613) / 15% Validation (1,417) / 15% Quarantined Test (1,417)
Zero modification to original PlantVillage images.
"""

import os
import sys
import json
import random
import hashlib
from pathlib import Path
from datetime import datetime
from collections import defaultdict


SEED = 42
random.seed(SEED)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "plant_disease" / "raw" / "PlantVillage"
SPLITS_DIR = PROJECT_ROOT / "data" / "plant_disease" / "splits"
MANIFEST_OUTPUT = SPLITS_DIR / "species_split_manifest_v1.json"

SPECIES_CLASSES = {
    0: "Tomato",
    1: "Potato",
    2: "Bell Pepper",
    3: "Unsupported"
}


def hash_file(filepath):
    """Compute both SHA-256 and MD5 for file."""
    h_sha256 = hashlib.sha256()
    h_md5 = hashlib.md5()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h_sha256.update(chunk)
            h_md5.update(chunk)
    return h_sha256.hexdigest(), h_md5.hexdigest()


def scan_and_deduplicate():
    """Scan all 54,305 raw files and deduplicate by SHA-256 hash."""
    print("=" * 70)
    print("STEP 1: Scanning raw PlantVillage dataset and computing content hashes...")
    print("=" * 70)

    seen_hashes = {}
    duplicates = []
    category_files = defaultdict(list)

    total_scanned = 0

    for split_dir in [RAW_DIR / "train", RAW_DIR / "val"]:
        if not split_dir.exists():
            raise FileNotFoundError(f"Directory not found: {split_dir}")

        for category_dir in sorted(split_dir.iterdir()):
            if not category_dir.is_dir():
                continue
            cat_name = category_dir.name
            for img_file in sorted(category_dir.iterdir()):
                if not img_file.is_file():
                    continue
                total_scanned += 1
                sha256_val, md5_val = hash_file(img_file)
                rel_path = str(img_file.relative_to(RAW_DIR)).replace("\\", "/")

                if sha256_val in seen_hashes:
                    duplicates.append({
                        "duplicate_path": rel_path,
                        "original_path": seen_hashes[sha256_val]["rel_path"],
                        "sha256": sha256_val,
                        "md5": md5_val,
                        "category": cat_name
                    })
                else:
                    record = {
                        "abs_path": img_file,
                        "rel_path": rel_path,
                        "sha256": sha256_val,
                        "md5": md5_val,
                        "category": cat_name
                    }
                    seen_hashes[sha256_val] = record
                    category_files[cat_name].append(record)

    print(f"Total files scanned: {total_scanned}")
    print(f"Unique content images: {len(seen_hashes)}")
    print(f"Duplicates identified and excluded: {len(duplicates)}")
    return category_files, duplicates


def sample_manifest(category_files):
    """
    Select balanced manifest:
      Tomato: 2,400 (240 x 10 subclasses) -> Train: 1680, Val: 360, Test: 360
      Potato: 2,152 (all unique)          -> Train: 1506, Val: 323, Test: 323
      Bell Pepper: 2,475 (all unique)     -> Train: 1733, Val: 371, Test: 371
      Unsupported: 2,420 (220 x 11 spp)   -> Train: 1694, Val: 363, Test: 363
      Total = 9,447                       -> Train: 6613, Val: 1417, Test: 1417
    """
    print("\n" + "=" * 70)
    print("STEP 2: Stratified sampling and partition allocation...")
    print("=" * 70)

    train_records = []
    val_records = []
    test_records = []

    # -------------------------------------------------------------
    # 1. TOMATO (Target: 2,400 total -> 1,680 train, 360 val, 360 test)
    # -------------------------------------------------------------
    tomato_subclasses = sorted([c for c in category_files if c.startswith("Tomato")])
    assert len(tomato_subclasses) == 10, f"Expected 10 tomato subclasses, found {len(tomato_subclasses)}"
    print(f"Tomato subclasses: {len(tomato_subclasses)}")

    for sc in tomato_subclasses:
        pool = list(category_files[sc])
        random.seed(SEED)
        random.shuffle(pool)
        assert len(pool) >= 240, f"Subclass {sc} has only {len(pool)} images (< 240)"
        selected = pool[:240]

        # 240 split: 168 train (70%), 36 val (15%), 36 test (15%)
        for r in selected[:168]:
            train_records.append({**r, "species_label": "Tomato", "species_index": 0, "split": "train"})
        for r in selected[168:204]:
            val_records.append({**r, "species_label": "Tomato", "species_index": 0, "split": "val"})
        for r in selected[204:240]:
            test_records.append({**r, "species_label": "Tomato", "species_index": 0, "split": "test"})

    # -------------------------------------------------------------
    # 2. POTATO (Target: 2,152 total -> 1,506 train, 323 val, 323 test)
    # -------------------------------------------------------------
    potato_subclasses = {
        "Potato___Early_blight": {"target": 1000, "train": 700, "val": 150, "test": 150},
        "Potato___Late_blight":  {"target": 1000, "train": 700, "val": 150, "test": 150},
        "Potato___healthy":      {"target": 152,  "train": 106, "val": 23,  "test": 23}
    }

    for sc, counts in potato_subclasses.items():
        pool = list(category_files[sc])
        assert len(pool) == counts["target"], f"Subclass {sc} expected {counts['target']}, got {len(pool)}"
        random.seed(SEED)
        random.shuffle(pool)

        n_tr = counts["train"]
        n_va = counts["val"]
        n_te = counts["test"]

        for r in pool[:n_tr]:
            train_records.append({**r, "species_label": "Potato", "species_index": 1, "split": "train"})
        for r in pool[n_tr:n_tr + n_va]:
            val_records.append({**r, "species_label": "Potato", "species_index": 1, "split": "val"})
        for r in pool[n_tr + n_va:n_tr + n_va + n_te]:
            test_records.append({**r, "species_label": "Potato", "species_index": 1, "split": "test"})

    # -------------------------------------------------------------
    # 3. BELL PEPPER (Target: 2,475 total -> 1,733 train, 371 val, 371 test)
    # -------------------------------------------------------------
    pepper_subclasses = {
        "Pepper,_bell___Bacterial_spot": {"target": 997,  "train": 698,  "val": 149, "test": 150},
        "Pepper,_bell___healthy":         {"target": 1478, "train": 1035, "val": 222, "test": 221}
    }

    for sc, counts in pepper_subclasses.items():
        pool = list(category_files[sc])
        assert len(pool) == counts["target"], f"Subclass {sc} expected {counts['target']}, got {len(pool)}"
        random.seed(SEED)
        random.shuffle(pool)

        n_tr = counts["train"]
        n_va = counts["val"]
        n_te = counts["test"]

        for r in pool[:n_tr]:
            train_records.append({**r, "species_label": "Bell Pepper", "species_index": 2, "split": "train"})
        for r in pool[n_tr:n_tr + n_va]:
            val_records.append({**r, "species_label": "Bell Pepper", "species_index": 2, "split": "val"})
        for r in pool[n_tr + n_va:n_tr + n_va + n_te]:
            test_records.append({**r, "species_label": "Bell Pepper", "species_index": 2, "split": "test"})

    # -------------------------------------------------------------
    # 4. UNSUPPORTED / OTHER (Target: 2,420 total -> 1,694 train, 363 val, 363 test)
    # 11 species: Apple, Blueberry, Cherry, Corn, Grape, Orange,
    #             Peach, Raspberry, Soybean, Squash, Strawberry
    # -------------------------------------------------------------
    other_species_map = defaultdict(list)
    for cat_name, records in category_files.items():
        if not (cat_name.startswith("Tomato") or cat_name.startswith("Potato") or "Pepper" in cat_name or "pepper" in cat_name):
            species_prefix = cat_name.split("___")[0]
            other_species_map[species_prefix].extend(records)

    assert len(other_species_map) == 11, f"Expected 11 unsupported species, found {len(other_species_map)}"
    print(f"Unsupported species: {len(other_species_map)}")

    for sp_name, pool in sorted(other_species_map.items()):
        assert len(pool) >= 220, f"Unsupported species {sp_name} has only {len(pool)} images (< 220)"
        random.seed(SEED)
        random.shuffle(pool)
        selected = pool[:220]

        # 220 split: 154 train (70%), 33 val (15%), 33 test (15%)
        for r in selected[:154]:
            train_records.append({**r, "species_label": "Unsupported", "species_index": 3, "split": "train"})
        for r in selected[154:187]:
            val_records.append({**r, "species_label": "Unsupported", "species_index": 3, "split": "val"})
        for r in selected[187:220]:
            test_records.append({**r, "species_label": "Unsupported", "species_index": 3, "split": "test"})

    return train_records, val_records, test_records


def validate_and_save(train_records, val_records, test_records, duplicates):
    """Rigorous integrity validation and manifest serialization."""
    print("\n" + "=" * 70)
    print("STEP 3: Integrity Validation...")
    print("=" * 70)

    all_records = train_records + val_records + test_records
    total_images = len(all_records)
    print(f"Total manifest records: {total_images} (Target: 9,447)")
    assert total_images == 9447, f"Total records {total_images} != 9447"

    # 1. Split counts check
    n_train = len(train_records)
    n_val = len(val_records)
    n_test = len(test_records)
    print(f"Split counts -> Train: {n_train} (6,613), Val: {n_val} (1,417), Test: {n_test} (1,417)")
    assert (n_train, n_val, n_test) == (6613, 1417, 1417), "Split counts mismatch"

    # 2. Per-class distribution check
    class_counts = defaultdict(lambda: {"train": 0, "val": 0, "test": 0, "total": 0})
    for r in all_records:
        lbl = r["species_label"]
        spl = r["split"]
        class_counts[lbl][spl] += 1
        class_counts[lbl]["total"] += 1

    print("\nPer-Class Distribution:")
    for lbl in ["Tomato", "Potato", "Bell Pepper", "Unsupported"]:
        c = class_counts[lbl]
        print(f"  {lbl:12}: Train={c['train']:4}, Val={c['val']:4}, Test={c['test']:4} | Total={c['total']:4}")

    assert class_counts["Tomato"]["total"] == 2400
    assert class_counts["Potato"]["total"] == 2152
    assert class_counts["Bell Pepper"]["total"] == 2475
    assert class_counts["Unsupported"]["total"] == 2420

    # 3. Hash uniqueness check
    hashes_train = {r["sha256"] for r in train_records}
    hashes_val = {r["sha256"] for r in val_records}
    hashes_test = {r["sha256"] for r in test_records}

    assert len(hashes_train) == n_train, "Train split contains duplicate hashes"
    assert len(hashes_val) == n_val, "Val split contains duplicate hashes"
    assert len(hashes_test) == n_test, "Test split contains duplicate hashes"

    overlap_tr_val = hashes_train & hashes_val
    overlap_tr_te = hashes_train & hashes_test
    overlap_val_te = hashes_val & hashes_test

    print("\nCross-Split Hash Overlap Check:")
    print(f"  Train and Val:  {len(overlap_tr_val)} collisions")
    print(f"  Train and Test: {len(overlap_tr_te)} collisions")
    print(f"  Val and Test:   {len(overlap_val_te)} collisions")

    assert len(overlap_tr_val) == 0, "Leakage detected: Train and Val overlap"
    assert len(overlap_tr_te) == 0, "Leakage detected: Train and Test overlap"
    assert len(overlap_val_te) == 0, "Leakage detected: Val and Test overlap"

    # 4. Verify physical on-disk file existence
    print("\nVerifying physical on-disk existence for all 9,447 files...")
    for idx, r in enumerate(all_records):
        full_p = RAW_DIR / r["rel_path"]
        if not full_p.is_file():
            raise FileNotFoundError(f"Missing file on disk: {full_p}")

    print("All 9,447 manifest files exist on disk and verified!")

    # 5. Build and save JSON manifest
    SPLITS_DIR.mkdir(parents=True, exist_ok=True)

    manifest_data = {
        "metadata": {
            "version": "1.0",
            "seed": SEED,
            "created_at": datetime.now().isoformat(),
            "generator_script": "scripts/generate_species_manifest.py",
            "dataset_root": str(RAW_DIR.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "total_images": total_images,
            "splits": {
                "train": n_train,
                "val": n_val,
                "test": n_test
            },
            "classes": {
                0: "Tomato",
                1: "Potato",
                2: "Bell Pepper",
                3: "Unsupported"
            },
            "class_counts": {lbl: class_counts[lbl]["total"] for lbl in class_counts},
            "split_class_matrix": {lbl: dict(class_counts[lbl]) for lbl in class_counts},
            "excluded_duplicates_count": len(duplicates),
            "quarantined_test_note": (
                "The test split (1,417 images) is strictly quarantined and must NEVER be used "
                "for model training, checkpoint selection, learning-rate adjustment, or threshold tuning."
            )
        },
        "excluded_duplicates": duplicates,
        "images": [
            {
                "id": idx,
                "relative_path": r["rel_path"],
                "sha256": r["sha256"],
                "md5": r["md5"],
                "species_label": r["species_label"],
                "species_index": r["species_index"],
                "source_category": r["category"],
                "split": r["split"]
            }
            for idx, r in enumerate(all_records)
        ]
    }

    with open(MANIFEST_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)

    print(f"\nManifest successfully written to: {MANIFEST_OUTPUT}")
    print(f"Manifest file size: {os.path.getsize(MANIFEST_OUTPUT):,} bytes")
    return MANIFEST_OUTPUT


def main():
    category_files, duplicates = scan_and_deduplicate()
    train_records, val_records, test_records = sample_manifest(category_files)
    manifest_path = validate_and_save(train_records, val_records, test_records, duplicates)
    print("\nManifest generation completed successfully with zero errors!")


if __name__ == "__main__":
    main()
