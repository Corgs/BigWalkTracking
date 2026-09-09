import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def load_route(path: Path):
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
    return [row for row in rows if row.get("type") == "route-point"]


def mean_position(points, start, end):
    selected = [p for p in points if start <= p["sequence"] <= end]
    return np.array([np.mean([p["x"] for p in selected]), np.mean([p["z"] for p in selected])], np.float32)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", type=Path, required=True)
    parser.add_argument("--clean", type=Path, required=True)
    parser.add_argument("--route", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    raw = cv2.imread(str(args.raw))
    clean = cv2.imread(str(args.clean))
    if raw is None or clean is None:
        raise SystemExit("Could not load one or both map images")

    raw_gray = cv2.cvtColor(raw, cv2.COLOR_BGR2GRAY)
    clean_gray = cv2.cvtColor(clean, cv2.COLOR_BGR2GRAY)
    mask = np.zeros(raw_gray.shape, np.uint8)
    polygon = np.array([[330, 0], [1580, 0], [1460, 1080], [450, 1080]], np.int32)
    cv2.fillConvexPoly(mask, polygon, 255)

    sift = cv2.SIFT_create(nfeatures=12000)
    key_raw, desc_raw = sift.detectAndCompute(raw_gray, mask)
    key_clean, desc_clean = sift.detectAndCompute(clean_gray, None)
    matches = cv2.BFMatcher().knnMatch(desc_raw, desc_clean, k=2)
    good = [a for a, b in matches if a.distance < 0.68 * b.distance]
    if len(good) < 12:
        raise SystemExit(f"Only {len(good)} reliable feature matches")

    raw_xy = np.float32([key_raw[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    clean_xy = np.float32([key_clean[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
    homography, inlier_mask = cv2.findHomography(raw_xy, clean_xy, cv2.RANSAC, 4.0)
    if homography is None:
        raise SystemExit("Homography estimation failed")

    # Pixel centres of the three purple spots in the user's marked 1920x1080 screenshot.
    marked_raw = np.float32([[[762, 403]], [[775, 470]], [[813, 395]]])
    marked_clean = cv2.perspectiveTransform(marked_raw, homography).reshape(3, 2)

    route = load_route(args.route)
    # Initial spawn is sequences 1-6. The three requested stops follow it.
    world = np.vstack([
        mean_position(route, 119, 122),
        mean_position(route, 195, 200),
        mean_position(route, 307, 309),
    ])

    design = np.column_stack([world, np.ones(3, np.float32)])
    affine = np.linalg.solve(design, marked_clean)
    route_world = np.float32([[p["x"], p["z"], 1.0] for p in route])
    route_pixels = route_world @ affine

    overlay = clean.copy()
    valid = np.isfinite(route_pixels).all(axis=1)
    polyline = np.round(route_pixels[valid]).astype(np.int32).reshape(-1, 1, 2)
    cv2.polylines(overlay, [polyline], False, (184, 69, 230), 5, cv2.LINE_AA)
    for index, pixel in enumerate(marked_clean, 1):
        centre = tuple(np.round(pixel).astype(int))
        cv2.circle(overlay, centre, 12, (184, 69, 230), -1, cv2.LINE_AA)
        cv2.circle(overlay, centre, 15, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(overlay, str(index), (centre[0] + 18, centre[1] - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 3, cv2.LINE_AA)
        cv2.putText(overlay, str(index), (centre[0] + 18, centre[1] - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (110, 20, 140), 1, cv2.LINE_AA)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(args.output), overlay)
    result = {
        "featureMatches": len(good),
        "homographyInliers": int(inlier_mask.sum()),
        "anchors": [
            {"point": i + 1, "worldX": float(world[i, 0]), "worldZ": float(world[i, 1]), "pixelX": float(marked_clean[i, 0]), "pixelY": float(marked_clean[i, 1])}
            for i in range(3)
        ],
        "worldToPixel": {
            "pixelX": {"x": float(affine[0, 0]), "z": float(affine[1, 0]), "offset": float(affine[2, 0])},
            "pixelY": {"x": float(affine[0, 1]), "z": float(affine[1, 1]), "offset": float(affine[2, 1])},
        },
    }
    calibration_path = args.output.with_suffix(".json")
    calibration_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
