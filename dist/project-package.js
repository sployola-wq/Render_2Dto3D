export const PROJECT_PACKAGE_SCHEMA='prodalam.project.v1';

function validPoint(p){
  return Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1]);
}

export function createProjectPackage({
  asset,
  sourceDataUrl=null,
  dxfText=null,
  width,
  height,
  step=1,
  preparation={},
  calibration=null,
  measurements=[],
  boundary=[],
  discipline={},
  vectors=null,
  bounds=null,
  presentation=null,
  appVersion='3.4.0'
}={}){
  if(!asset?.identity||typeof asset.identity!=='string'||!/^[a-f0-9]{64}$/i.test(asset.identity)){
    throw new Error('El proyecto requiere una lámina con huella SHA-256 válida.');
  }
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<64||height<64){
    throw new Error('Dimensiones de lámina no válidas para guardar el proyecto.');
  }
  if(!sourceDataUrl&&!dxfText){
    throw new Error('El paquete del proyecto requiere la lámina fuente codificada.');
  }
  return {
    schema:PROJECT_PACKAGE_SCHEMA,
    appVersion,
    savedAt:new Date().toISOString(),
    asset:{
      name:String(asset.name??'plano.png'),
      kind:['image','pdf','dxf'].includes(asset.kind)?asset.kind:'image',
      identity:asset.identity.toLowerCase(),
      page:Number.isInteger(asset.page)&&asset.page>=1?asset.page:1,
      width,
      height,
      sourceDataUrl:sourceDataUrl??null,
      dxfText:dxfText??null
    },
    step:[1,2,3].includes(Number(step))?Number(step):1,
    preparation:{
      grayscale:!!preparation.grayscale,
      invertContrast:!!preparation.invertContrast,
      paperCleanup:!!preparation.paperCleanup,
      vectorWidth:Number.isFinite(Number(preparation.vectorWidth))?Number(preparation.vectorWidth):1,
      measureUnit:preparation.measureUnit==='mm'?'mm':'m',
      technicalGrid:preparation.technicalGrid!==false,
      dimensionToggle:!!preparation.dimensionToggle
    },
    calibration:calibration&&Number.isFinite(calibration.metersPerPixel)&&calibration.metersPerPixel>0?calibration:null,
    measurements:Array.isArray(measurements)?measurements.filter(m=>Array.isArray(m)&&m.length===2&&validPoint(m[0])&&validPoint(m[1])): [],
    boundary:Array.isArray(boundary)&&boundary.every(validPoint)?boundary:[],
    discipline:{
      routingMode:typeof discipline.routingMode==='string'?discipline.routingMode:'auto',
      domain:typeof discipline.domain==='string'?discipline.domain:'interior',
      records:discipline.records&&typeof discipline.records==='object'?discipline.records:{}
    },
    vectors:vectors??null,
    bounds:bounds??null,
    presentation:presentation?.dataUrl&&presentation?.record?{dataUrl:presentation.dataUrl,record:presentation.record}:null
  };
}

export function restoreProjectPackage(raw){
  const pkg=typeof raw==='string'?JSON.parse(raw):raw;
  if(!pkg||pkg.schema!==PROJECT_PACKAGE_SCHEMA){
    throw new Error('El archivo no es un paquete de proyecto compatible (prodalam.project.v1).');
  }
  const a=pkg.asset;
  if(!a||typeof a.identity!=='string'||!/^[a-f0-9]{64}$/i.test(a.identity)){
    throw new Error('El paquete del proyecto no contiene una huella SHA-256 válida.');
  }
  if(!Number.isInteger(a.width)||!Number.isInteger(a.height)||a.width<64||a.height<64){
    throw new Error('Las dimensiones de la lámina guardada no son válidas.');
  }
  if(typeof a.sourceDataUrl!=='string'&&typeof a.dxfText!=='string'){
    throw new Error('El paquete del proyecto no incluye la lámina original.');
  }
  if(pkg.calibration){
    if(pkg.calibration.imageSha256&&pkg.calibration.imageSha256.toLowerCase()!==a.identity.toLowerCase()){
      throw new Error('La calibración guardada no corresponde a la lámina del proyecto.');
    }
    if(!Number.isFinite(pkg.calibration.metersPerPixel)||pkg.calibration.metersPerPixel<=0){
      throw new Error('La escala calibrada del paquete no es válida.');
    }
  }
  return createProjectPackage({
    asset:a,
    sourceDataUrl:a.sourceDataUrl,
    dxfText:a.dxfText,
    width:a.width,
    height:a.height,
    step:pkg.step,
    preparation:pkg.preparation,
    calibration:pkg.calibration,
    measurements:pkg.measurements,
    boundary:pkg.boundary,
    discipline:pkg.discipline,
    vectors:pkg.vectors,
    bounds:pkg.bounds,
    presentation:pkg.presentation,
    appVersion:pkg.appVersion??'3.4.0'
  });
}
