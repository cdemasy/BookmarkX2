cb = chrome.bookmarks;
storage = chrome.storage.sync;
noti = chrome.notifications;

//After bookmark moved
cb.onMoved.addListener(async function (id, moveInfo) {
  let bookmark = await getBookmark(id);
  associateDomain(bookmark.url, moveInfo.parentId, moveInfo.oldParentId);
});

//After bookmark removed
cb.onRemoved.addListener(async function (parentId, removeInfo) {
  console.log("removed "+removeInfo.node.url+" "+removeInfo.parentId);
  console.log(removeInfo);
  associateDomain(removeInfo.node.url, undefined, removeInfo.parentId);
});

//After bookmark created
cb.onCreated.addListener(async function (id, bookmark) {
  let domain = getDomainName(bookmark.url);
  let folders = await getAssociatedFolders(domain);

  if (typeof folders != "undefined") {
    await hideBookmarksPopup();

    let parentFolderId = firstKey(folders[0]);
    await associateDomain(domain, bookmark.parentId, undefined);

    if (bookmark.parentId != parentFolderId)
      await cb.move(id, { parentId: parentFolderId });
  }
  else await associateDomain(domain, bookmark.parentId, undefined);

  showCreatedBookmarkNotification(id);
});

async function associateDomain(domain, parentFolderId, oldParentFolderId) {
  if (parentFolderId == oldParentFolderId) return;

  domain = getDomainName(domain);
  let folders = await getAssociatedFolders(domain);
  if (typeof folders == "undefined") folders = [{ [parentFolderId]: 0 }];

  if (parentFolderId) {
    let newIndex = folders.findIndex(el => el[parentFolderId] != undefined);
    if (newIndex == -1) {
      folders.push({ [parentFolderId]: 0 });
      newIndex = folders.length - 1;
    }
    addToFirstVal(folders[newIndex], 1);
  }

  let oldIndex = folders.findIndex(el => el[oldParentFolderId] != undefined);
  if (oldParentFolderId && oldIndex != -1) {
    if (addToFirstVal(folders[oldIndex], -1) == 0)
      folders.splice(oldIndex, 1);
  }
  
  //Sort decreasing size
  folders.sort((a, b) => (firstVal(a) < firstVal(b)) ? 1
    : (firstVal(b) < firstVal(a)) ? -1 : 0);

  if(folders.length == 0) await storage.remove(domain);
  else await storage.set({ [domain]: folders });
  console.log("Associated " + domain + " data: " + JSON.stringify(folders))
}

async function getAssociatedFolders(domain) {
  domain = getDomainName(domain);
  let data = await storage.get(domain);
  return data[domain];
}

async function hideBookmarksPopup() {
  let lastFocused = await chrome.windows.getLastFocused();
  await chrome.windows.update(lastFocused.id, { focused: true });
}

async function showCreatedBookmarkNotification(id) {
  let bookmark = await getBookmark(id);
  let parentFolder = await getBookmark(bookmark.parentId);
  let folders = await getAssociatedFolders(bookmark.url);
  let changeButtons = [];
  for (let i = 1; i < 3 && i < folders.length; i++) {
    let folder = await getBookmark(firstKey(folders[i]));
    changeButtons.push({ title: `Move to '${folder.title}'`});
  }

  noti.create(
    {
      type: "basic", iconUrl: "icon.png",
      title: "BookmarkX2",
      message: `Bookmarked to '${parentFolder.title}'`,
      buttons: changeButtons,
      silent: true
    },
    changeNotificationId => {
      let twoFolders = folders.slice(1, 3);
      noti.onButtonClicked.addListener((notificationId, buttonIndex) => {
        let folderId = firstKey(twoFolders[buttonIndex]);
        if (notificationId == changeNotificationId)
          cb.move(id, { parentId: folderId });
      });
    }
  );

}

async function getBookmark(id){
  return (await cb.get(id))[0];
}

function firstKey(object){
  return Object.keys(object)[0];
}
function firstVal(object){
  return Object.values(object)[0];
}
function setFirstVal(object, val){
  return object[firstKey(object)] = val;
}
function addToFirstVal(object, val){
  return setFirstVal(object, firstVal(object)+val);
}

function getDomainName(v) {
  if (!v.startsWith("http")) return v;
  parser = document.createElement('a');
  parser.href = v;
  v = parser.host;

  var is_co = v.match(/\.co\./);
  v = v.split('.');
  v = v.slice(is_co ? -3 : -2);
  v = v.join('.');

  return v;
};
