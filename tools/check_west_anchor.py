"""Read-only registration of the user's western-landmark crop to the base map."""
import argparse
import json
from pathlib import Path
import cv2
import numpy as np

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('crop', type=Path, help='Path to the landmark screenshot crop')
parser.add_argument('--map', dest='map_path', type=Path,
                    default=root / 'web/public/big-walk-map.png',
                    help='Path to the base map image')
args = parser.parse_args()
crop = cv2.imread(str(args.crop.expanduser()))
if crop is None:
    parser.error(f'Could not read crop image: {args.crop}')
base = cv2.imread(str(args.map_path.expanduser()))
if base is None:
    parser.error(f'Could not read base map image: {args.map_path}; supply --map PATH')
sift = cv2.SIFT_create(nfeatures=15000, contrastThreshold=.015)
k1, d1 = sift.detectAndCompute(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY), None)
k2, d2 = sift.detectAndCompute(cv2.cvtColor(base, cv2.COLOR_BGR2GRAY), None)
matches = [a for a, b in cv2.BFMatcher().knnMatch(d1, d2, k=2) if a.distance < .72*b.distance]
src = np.float32([k1[m.queryIdx].pt for m in matches])
dst = np.float32([k2[m.trainIdx].pt for m in matches])
matrix, mask = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=2)
print(json.dumps({'matches': len(matches), 'inliers': int(mask.sum()), 'matrix': matrix.tolist(), 'purple': (matrix @ [84,102,1]).tolist(), 'player': (matrix @ [104,102,1]).tolist(), 'residuals': np.linalg.norm(np.column_stack([src,np.ones(len(src))]) @ matrix.T-dst,axis=1)[mask.ravel().astype(bool)].tolist()}, indent=2))
