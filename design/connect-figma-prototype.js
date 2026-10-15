// Run through Figma MCP use_figma against the recorded design file.
const page = await figma.getNodeByIdAsync('0:1');
await figma.setCurrentPageAsync(page);
const links = [['2:281','2:289'],['2:265','2:289'],['2:295','2:222'],['2:255','2:345'],['2:375','2:289'],['2:338','2:383'],['2:417','2:423'],['2:439','2:222']];
for (const [source, target] of links) {
  const node = await figma.getNodeByIdAsync(source);
  await node.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:target,navigation:'NAVIGATE',transition:null,preserveScrollPosition:false}]}]);
}
return {mutatedNodeIds:links.map(([source])=>source)};
