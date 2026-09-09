"""Read reference imagery to register public marker coordinates; outputs JSON only."""
import json
from pathlib import Path

import cv2
import numpy as np

root = Path(__file__).resolve().parents[1]
clean = cv2.imread(str(root / "web/public/big-walk-map.png"), cv2.IMREAD_GRAYSCALE)
sift = cv2.SIFT_create(nfeatures=12000)
clean_keys, clean_descriptors = sift.detectAndCompute(clean, None)
source, target, counts = [], [], []
for y in (509, 510):
    for x in (509, 510):
        tile = cv2.imread(str(root / f"assets/mapgenie-reference-10-{y}-{x}.jpg"), cv2.IMREAD_GRAYSCALE)
        keys, descriptors = sift.detectAndCompute(tile, None)
        matches = cv2.BFMatcher().knnMatch(descriptors, clean_descriptors, k=2)
        reliable = [a for a, b in matches if a.distance < 0.68 * b.distance]
        counts.append({"x": x, "y": y, "matches": len(reliable)})
        for match in reliable:
            tx, ty = keys[match.queryIdx].pt
            source.append([tx + (x - 509) * 256, ty + (y - 509) * 256])
            target.append(clean_keys[match.trainIdx].pt)

source, target = np.float32(source), np.float32(target)
matrix, mask = cv2.estimateAffinePartial2D(source, target, method=cv2.RANSAC, ransacReprojThreshold=2.5)
if matrix is None or int(mask.sum()) < 20:
    raise RuntimeError("Insufficient map image matches")
projected = np.column_stack([source, np.ones(len(source))]) @ matrix.T
residuals = np.linalg.norm(projected - target, axis=1)[mask.ravel().astype(bool)]
print(json.dumps({"zoom": 10, "tileSize": 256, "originTile": [509, 509], "imageSize": [int(clean.shape[1]), int(clean.shape[0])], "matrix": matrix.tolist(), "matches": counts, "inliers": int(mask.sum()), "medianErrorPixels": float(np.median(residuals)), "p95ErrorPixels": float(np.percentile(residuals, 95))}, indent=2))
