cb = chrome.bookmarks;
storage = chrome.storage.sync;
noti = chrome.notifications;

async function analyseBookmarks(){
  analysisData = {};
  storage.clear();
  let bms = await cb.getTree();
  bms.forEach(async function(bm) {
    await analyseRecursively(bm);
  });

  for (var key in analysisData){
    let data = analysisData[key];
    data.sort((a,b) => (Object.values(a)[0] < Object.values(b)[0]) ? 1 
                        : (Object.values(b)[0] < Object.values(a)[0]) ? -1 : 0);
  }

  storage.set(analysisData);
}
async function analyseRecursively(bm){
  if(bm.children){
    bm.children.forEach(async function(c) {
      await analyseRecursively(c);
    });
  }
  else{
    let domain = getDomainName(bm.url);
    let parentFolderId = bm.parentId;
    let data = analysisData[domain];
    if (!data) data = [];
    let newIndex = data.findIndex(el => el[parentFolderId] != undefined);

    if(newIndex == -1) {
      data.push({[parentFolderId]:0});
      newIndex = data.length-1;
    }
    data[newIndex][ Object.keys(data[newIndex])[0] ] += 1;
    analysisData[domain] = data;
  }
}

function getDomainName(v) {
  if(!v.startsWith("http")) return v;
  parser = document.createElement('a');
  parser.href = v;
  v = parser.host;

  var is_co = v.match(/\.co\./);
  v = v.split('.');
  v = v.slice(is_co ? -3 : -2);
  v = v.join('.');

  return v;
};

document.addEventListener('DOMContentLoaded', function() {
    const button = document.getElementById('analyseButton');
    // onClick's logic below:
    button.addEventListener('click', async function() {
        await analyseBookmarks();
        let result = document.createElement("p");
        result.innerHTML = "Success"
        document.querySelector("body").appendChild(result);
    });
});