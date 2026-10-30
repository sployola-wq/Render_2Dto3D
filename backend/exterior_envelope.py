"""Observed silhouette and facade fold for an editable, closed exterior study."""
import io
import cv2
import numpy as np
from PIL import Image, ImageOps

def exterior_envelope(payload):
    image=ImageOps.exif_transpose(Image.open(io.BytesIO(payload))).convert('RGB')
    if image.width*image.height>25_000_000: raise ValueError('Imagen demasiado grande.')
    factor=min(1,1400/max(image.size));image=image.resize((round(image.width*factor),round(image.height*factor)),Image.Resampling.LANCZOS)
    rgb=np.asarray(image);h,w=rgb.shape[:2];gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
    ink=(gray<170).astype(np.uint8)
    ink[:,ink.mean(0)>.8]=0;ink[ink.mean(1)>.8,:]=0
    kernel=2 if ((gray>200)&(gray<248)).mean()>.15 else 3
    strong=cv2.morphologyEx(ink,cv2.MORPH_OPEN,np.ones((kernel,kernel),np.uint8))
    closed=cv2.morphologyEx(strong,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
    count,ids,stats,_=cv2.connectedComponentsWithStats(closed)
    if count>=2:
        main=1+int(np.argmax(stats[1:,4]));x,y,bw,bh,size=map(int,stats[main])
    else:
        bw=bh=size=0
    if count<2 or bh<h*.12 or bw<w*.12:
        raw_count,raw_ids,raw_stats,_=cv2.connectedComponentsWithStats(ink)
        filtered=np.zeros_like(ink)
        for idx in range(1,raw_count):
            if raw_stats[idx,4]>=16 and raw_stats[idx,2]<w*.96 and raw_stats[idx,3]<h*.96:
                filtered[raw_ids==idx]=1
        strong=filtered if filtered.any() else ink
        closed=cv2.morphologyEx(strong,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
        count,ids,stats,_=cv2.connectedComponentsWithStats(closed)
        if count<2:return None
        main=1+int(np.argmax(stats[1:,4]));x,y,bw,bh,size=map(int,stats[main])
    if size<w*h*.002:return None
    mask=(ids==main).astype(np.uint8)
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
    contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    contour=max(contours,key=cv2.contourArea);mask[:]=0;cv2.drawContours(mask,[contour],-1,1,-1)
    # A drafting whisker is not a roof spike or a foundation fin. Remove
    # narrow protrusions after filling the structural silhouette.
    cleanup=max(3,int(round(min(w,h)*.009))|1)
    mask=cv2.morphologyEx(mask,cv2.MORPH_OPEN,np.ones((cleanup,cleanup),np.uint8))
    contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    if not contours:return None
    contour=max(contours,key=cv2.contourArea)
    vertical=cv2.HoughLinesP(strong*255,1,np.pi/180,threshold=40,minLineLength=h*.13,maxLineGap=10)
    ends=[max(int(q[1]),int(q[3])) for q in ([] if vertical is None else vertical[:,0]) if abs(q[2]-q[0])<abs(q[3]-q[1])*.08 and x<q[0]<x+bw]
    if ends:
        cutoff=min(h-1,int(np.quantile(ends,.9)+h*.08));mask[cutoff:]=0
        contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);contour=max(contours,key=cv2.contourArea)
    x,y,bw,bh=cv2.boundingRect(contour)
    if bh<h*.15:
        ink2=(gray<205).astype(np.uint8)
        ink2[:,ink2.mean(0)>.8]=0;ink2[ink2.mean(1)>.8,:]=0
        closed2=cv2.morphologyEx(ink2,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
        c2,ids2,stats2,_=cv2.connectedComponentsWithStats(closed2)
        if c2>=2:
            m2=1+int(np.argmax(stats2[1:,4]))
            mask2=(ids2==m2).astype(np.uint8)
            contours2,_=cv2.findContours(mask2,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
            if contours2:
                c_max=max(contours2,key=cv2.contourArea);mask2[:]=0;cv2.drawContours(mask2,[c_max],-1,1,-1)
                mask2=cv2.morphologyEx(mask2,cv2.MORPH_OPEN,np.ones((cleanup,cleanup),np.uint8))
                contours2,_=cv2.findContours(mask2,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
                if contours2:
                    c_max=max(contours2,key=cv2.contourArea)
                    x2,y2,bw2,bh2=cv2.boundingRect(c_max)
                    if bh2>bh*1.5:
                        mask,contour,strong,x,y,bw,bh=mask2,c_max,ink2,x2,y2,bw2,bh2
    lines=cv2.HoughLinesP(strong*255,1,np.pi/180,threshold=50,minLineLength=max(30,bh*.20),maxLineGap=bh*.04)
    candidates=[];positive=[];negative=[]
    for x0,y0,x1,y1 in [] if lines is None else lines[:,0]:
        dx=x1-x0;dy=y1-y0;length=float(np.hypot(dx,dy));cx=(x0+x1)/2;cy=(y0+y1)/2
        if cy<y+bh*.40:continue
        if abs(dx)<abs(dy)*.07 and x+bw*.4<cx<x+bw*.87:
            score=length*(1-abs((cx-x)/bw-.7))
            candidates.append((score,cx))
        elif abs(dx)>bw*.12:
            slope=dy/dx
            if .015<slope<.45:positive.extend([slope]*max(1,int(length/15)))
            if -.6<slope<-.015:negative.extend([-slope]*max(1,int(length/15)))
    corner=int(round(max(candidates)[1])) if candidates else int(x+bw*.68)
    corner=max(x+int(bw*.35),min(x+int(bw*.87),corner))
    top=[];bottom=[]
    for u in range(x,x+bw):
        ys=np.flatnonzero(mask[:,u]);top.append([u,int(ys.min())]);bottom.append([u,int(ys.max())])
    def profile(points):
        curve=np.asarray(points,dtype=np.float32).reshape(-1,1,2)
        simplified=cv2.approxPolyDP(curve,2.0,False).reshape(-1,2).tolist()
        return simplified
    return {'algorithm':'observed-silhouette-fold-v1','width':w,'height':h,'bounds':[x,y,x+bw,y+bh],
            'corner':corner,'cornerObserved':bool(candidates),'top':profile(top),'bottom':profile(bottom),
            'frontSlope':float(np.median(positive)) if positive else .10,'sideSlope':float(np.median(negative)) if negative else .25,
            'outline':cv2.approxPolyDP(contour,2,True).reshape(-1,2).tolist(),
            'depthProposed':True,'hiddenGeometryProposed':True,'contourTolerancePixels':cleanup//2+2}
