/** cytoscape-dagre ships no types; it's a Cytoscape layout extension. */
declare module "cytoscape-dagre" {
  import type { Ext } from "cytoscape";
  const ext: Ext;
  export default ext;
}
