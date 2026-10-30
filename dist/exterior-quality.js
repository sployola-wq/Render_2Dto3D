/** A coherent source picture does not prove a coherent 3D reconstruction.
 * Never replace failed depth recovery with unrelated architectural masses.
 * Explicit conceptual studies and manually specified profiles remain available.
 */
export function assertExteriorReconstruction(project){
  if(project.domain!=='exterior'||project.params?.exteriorMode!=='volume')return;
  if(project.profiles?.some(p=>['user-traced','cad'].includes(p.source)))return;
  const r=project.sourceReconstruction;
  if(r?.representation==='relief'||r?.quality?.valid===false){
    const error=new Error('Fachada reconocida; la profundidad aún no se pudo reconstruir de forma fiable. El Paso 2 conserva los contornos y las aberturas detectadas para revisarlos. Delimita y traza el perfil de un alzado, o utiliza una vista frontal acotada. Diseño conceptual es una propuesta independiente y no reproduce este edificio.');
    error.review={sourceHash:project.sourceHash,domain:'exterior',status:'needs-geometry',quality:r.quality,faces:r.faces?.map(f=>({outer:f.outer,role:f.role})),openings:project.exteriorEnvelope?.openings??[]};
    error.code='EXTERIOR_DEPTH_UNRESOLVED';throw error;
  }
}
