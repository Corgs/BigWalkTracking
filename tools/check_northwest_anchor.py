"""Read-only screenshot registration and comparison of calibration models."""
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
sift = cv2.SIFT_create(nfeatures=15000, contrastThreshold=.01)
k1, d1 = sift.detectAndCompute(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY), None)
k2, d2 = sift.detectAndCompute(cv2.cvtColor(base, cv2.COLOR_BGR2GRAY), None)
matches = [a for a, b in cv2.BFMatcher().knnMatch(d1, d2, k=2) if a.distance < .75*b.distance]
src = np.float32([k1[m.queryIdx].pt for m in matches])
dst = np.float32([k2[m.trainIdx].pt for m in matches])
matrix, mask = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=2)
if matrix is None:
    # This very small crop has too few SIFT features. Register unchanged map
    # artwork only, masking the orange route, white marker, arrow and purple ink.
    blue,green,red = cv2.split(crop)
    overlay = ((red > 210) & (green < 180)) | ((red > 235) & (green > 235) & (blue > 235)) | (np.max(crop,axis=2) < 45) | ((red > 100) & (blue > 75) & (green < red*.8))
    overlay = cv2.dilate(overlay.astype(np.uint8),np.ones((3,3),np.uint8)).astype(bool)
    valid = (~overlay).astype(np.uint8)*255
    candidates = []
    for scale in np.arange(.66,.801,.005):
        resized = cv2.resize(crop,None,fx=scale,fy=scale,interpolation=cv2.INTER_AREA)
        valid_small = cv2.resize(valid,(resized.shape[1],resized.shape[0]),interpolation=cv2.INTER_NEAREST)
        scores = cv2.matchTemplate(base,resized,cv2.TM_SQDIFF_NORMED,mask=valid_small)
        score,_,location,_ = cv2.minMaxLoc(scores)
        candidates.append((score,float(scale),location))
    candidates.sort()
    print('TEMPLATE',json.dumps(candidates[:10]))
    score,scale,(tx,ty)=candidates[0]
    # Refine translation/scale at subpixel precision against the unchanged
    # colour pixels, avoiding integer resize quantisation in the coarse match.
    yy,xx = np.indices(crop.shape[:2],dtype=np.float32)
    allowed = valid.astype(bool)
    refined = []
    for s in np.arange(.705,.746,.002):
        for x in np.arange(tx-2,tx+2,.2):
            for y in np.arange(ty-1.5,ty+1.5,.2):
                sample = cv2.remap(base,(xx*s+x).astype(np.float32),(yy*s+y).astype(np.float32),cv2.INTER_LINEAR)
                error = np.mean((sample[allowed].astype(float)-crop[allowed])**2)
                refined.append((float(error),float(s),float(x),float(y)))
    refined.sort()
    print('REFINED',json.dumps(refined[:3]))
    _,scale,tx,ty=refined[0]
    matrix = np.array([[scale,0,tx],[0,scale,ty]])
    mask = np.zeros((len(matches),1),dtype=np.uint8)
blue,green,red = cv2.split(crop)
orange = ((red > 230) & (green > 60) & (green < 140) & (blue < 70)).astype(np.uint8)
count,labels,stats,centres = cv2.connectedComponentsWithStats(orange)
print('ORANGE CENTRES',json.dumps([(stats[i].tolist(),centres[i].tolist()) for i in range(1,count)]))
purple = matrix @ [24,24,1]
print(json.dumps({'matches': len(matches), 'inliers': int(mask.sum()), 'matrix': matrix.tolist(), 'purple': purple.tolist(), 'player': (matrix @ [49,33,1]).tolist(), 'source':src.tolist(), 'target':dst.tolist(), 'residuals': np.linalg.norm(np.column_stack([src,np.ones(len(src))]) @ matrix.T-dst,axis=1)[mask.ravel().astype(bool)].tolist()}, indent=2))
world = np.array([[-172.125,-550.592],[-116.493,-484.229],[-297.647,-852.602],[-425.534,-766.261]])
pixels = np.array([[286.6098327636719,244.378173828125],[326.7553405761719,239.3516387939453],[132.42689687995858,307.7218899959372],purple])
A = np.column_stack([world, np.ones(len(world))])
affine = np.linalg.lstsq(A,pixels,rcond=None)[0]
D = world-world[0]
anchored = np.linalg.lstsq(D[1:],pixels[1:]-pixels[0],rcond=None)[0]
B = np.zeros((8,4)); B[::2,0] = world[:,0]; B[::2,1] = world[:,1]; B[::2,2] = 1
B[1::2,0] = -world[:,1]; B[1::2,1] = world[:,0]; B[1::2,3] = 1
similarity = np.linalg.lstsq(B,pixels.ravel(),rcond=None)[0]
for name,matrix,predicted in [('affine',affine,A@affine),('anchored-affine',anchored,D@anchored+pixels[0]),('similarity',similarity,(B@similarity).reshape(-1,2))]:
    print(json.dumps({'model':name,'matrix':matrix.tolist(),'predicted':predicted.tolist(),'residuals':np.linalg.norm(predicted-pixels,axis=1).tolist()},indent=2))
print('SCALE',float(np.hypot(similarity[0],similarity[1])))
for name in ['affine','similarity']:
    errors=[]
    for i in range(4):
        if name=='affine':
            keep=np.arange(4)!=i
            fitted=np.linalg.lstsq(A[keep],pixels[keep],rcond=None)[0]
            predicted=A[i]@fitted
        else:
            keep=np.ones(8,dtype=bool);keep[2*i:2*i+2]=False
            fitted=np.linalg.lstsq(B[keep],pixels.ravel()[keep],rcond=None)[0]
            predicted=B[2*i:2*i+2]@fitted
        errors.append(float(np.linalg.norm(predicted-pixels[i])))
    print('HOLDOUT',name,errors)
