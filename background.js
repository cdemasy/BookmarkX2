cb = chrome.bookmarks;
storage = chrome.storage.sync;
noti = chrome.notifications;

var isMoving = false;
const moveQueue = [];

//After bookmark moved
cb.onMoved.addListener(async function (id, moveInfo) {
  let bookmark = await getBookmark(id);
  if(!bookmark.url) return;
  moveQueue.push( {url: bookmark.url, parentId: moveInfo.parentId, oldParentId: moveInfo.oldParentId} );

  if(!isMoving){
    isMoving = true;
    while(moveQueue.length > 0){
      let o = moveQueue.pop();
      await associateDomain(o.url, o.parentId, o.oldParentId);
    }
    isMoving = false;
  }
});

//After bookmark removed
cb.onRemoved.addListener(async function (parentId, removeInfo) {
  if(removeInfo.node.children) removeInfo.node.children
    .forEach(async c => { await associateDomain(c.url, undefined, removeInfo.id); } );
  else 
    associateDomain(removeInfo.node.url, undefined, removeInfo.parentId);
});

//After bookmark created
cb.onCreated.addListener(async function (id, bookmark) {
  if(!bookmark.url) return;

  let domain = getDomainName(bookmark.url);
  let folders = await getAssociatedFolders(domain);

  if (typeof folders != "undefined") {
    await hideBookmarksPopup();

    let parentFolderId = folders[0].parentId;
    await associateDomain(domain, bookmark.parentId, undefined);

    if (bookmark.parentId != parentFolderId)
      await cb.move(id, {parentId: parentFolderId} );
  }
  else await associateDomain(domain, bookmark.parentId, undefined);

  showCreatedBookmarkNotification(id);
});

async function associateDomain(domain, parentFolderId, oldParentFolderId) {
  if (parentFolderId == oldParentFolderId) return;

  domain = getDomainName(domain);
  let folders = await getAssociatedFolders(domain);
  if (typeof folders == "undefined") folders = [ {parentId: parentFolderId, n: 0} ];

  if (parentFolderId) {
    let newIndex = folders.findIndex(el => el.parentId == parentFolderId);
    if (newIndex == -1) {
      folders.push( {parentId: parentFolderId, n: 0} );
      newIndex = folders.length - 1;
    }
    folders[newIndex].n++
  }

  let oldIndex = folders.findIndex(el => el.parentId == oldParentFolderId);
  if (oldParentFolderId && oldIndex != -1) {
    if (--folders[oldIndex].n == 0)
      folders.splice(oldIndex, 1);
  }
  
  //Sort decreasing size
  folders.sort((a, b) => (a.n < b.n) ? 1 : (b.n < a.n) ? -1 : 0);

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
    let folder = await getBookmark(folders[i].parentId);
    changeButtons.push({ title: `Move to '${folder.title}'`});
  }

  let notiCallback = function(changeNotificationId) {
    const twoFolders = folders.slice(1, 3);
    const bookmarkId = id;
    let buttonListener = (notificationId, buttonIndex) => {
      if (notificationId != changeNotificationId) return;

      let folderId = twoFolders[buttonIndex].parentId;
      cb.move(bookmarkId, { parentId: folderId });

      noti.onButtonClicked.removeListener(buttonListener);
    }
    noti.onButtonClicked.addListener(buttonListener);

    setTimeout(() => noti.clear(changeNotificationId), 10000);
  }

  noti.create(
    {
      type: "basic", iconUrl: "images/bmx128.png",
      title: "BookmarkX2",
      message: `Bookmarked to '${parentFolder.title}'`,
      buttons: changeButtons,
      silent: true
    }, notiCallback);

}

async function getBookmark(id){
  return (await cb.get(id))[0];
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
