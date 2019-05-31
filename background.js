cb = chrome.bookmarks;
storage = chrome.storage.sync;
noti = chrome.notifications;

//After bookmark moved
cb.onMoved.addListener(async function (id, moveInfo) {
  let bookmarks = await cb.get(id);
  associateDomain(bookmarks[0].url, moveInfo.parentId, moveInfo.oldParentId);

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
  let associatedFolders = await getAssociatedFolders(domain);

  if (typeof associatedFolders != "undefined") {
    await hideBookmarksPopup();

    let parentFolderId = Object.keys(associatedFolders[0])[0];
    await associateDomain(domain, bookmark.parentId, undefined);

    if (bookmark.parentId != parentFolderId)
      await cb.move(id, { parentId: parentFolderId });
  }
  else await associateDomain(domain, bookmark.parentId, undefined);

  showCreatedBookmarkNotification(id);
});

async function associateDomain(domain, parentFolderId, oldParentFolderId) {
  domain = getDomainName(domain);

  if (parentFolderId == oldParentFolderId) return;

  let data = await getAssociatedFolders(domain);
  if (typeof data == "undefined") data = [{ [parentFolderId]: 0 }];

  if (parentFolderId) {
    let newIndex = data.findIndex(el => el[parentFolderId] != undefined);
    if (newIndex == -1) {
      data.push({ [parentFolderId]: 0 });
      newIndex = data.length - 1;
    }
    data[newIndex][Object.keys(data[newIndex])[0]] += 1;
  }

  let oldIndex = data.findIndex(el => el[oldParentFolderId] != undefined);
  if (oldParentFolderId && oldIndex != -1) {
    if (--data[oldIndex][Object.keys(data[oldIndex])[0]] == 0)
      data.splice(oldIndex, 1);
  }
  
  data.sort((a, b) => (Object.values(a)[0] < Object.values(b)[0]) ? 1
    : (Object.values(b)[0] < Object.values(a)[0]) ? -1 : 0);

  if(data.length == 0) await storage.remove(domain);
  else await storage.set({ [domain]: data });
  console.log("Associated " + domain + " data: " + JSON.stringify(data))
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
  let bookmark = (await cb.get(id))[0];
  let parentFolder = (await cb.get(bookmark.parentId))[0];
  let associatedFolders = await getAssociatedFolders(bookmark.url);
  let changeButtons = [];
  for (let i = 1; i < 3 && i < associatedFolders.length; i++) {
    let folder = (await cb.get(Object.keys(associatedFolders[i])[0]))[0];
    changeButtons.push({ title: "Move to " + folder.title });
  }

  noti.create(
    {
      type: "basic", iconUrl: "icon.png",
      title: "BookmarkX2",
      message: "Bookmarked to " + parentFolder.title,
      buttons: changeButtons
    },
    changeNotificationId => {
      let folders = associatedFolders.slice(1, 3);
      noti.onButtonClicked.addListener((notificationId, buttonIndex) => {
        let folderId = Object.keys(folders[buttonIndex])[0];
        if (notificationId == changeNotificationId)
          cb.move(id, { parentId: folderId });
      });
    }
  );

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
