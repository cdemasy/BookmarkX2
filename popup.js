


async function analyseBookmarks(){
  chrome.runtime.sendMessage({type: "analyseBookmarks"}, function(response){
    analyseResult.innerHTML = "Success";
  });
}


document.addEventListener('DOMContentLoaded', function() {
  analyseResult = document.getElementById("analyseResult");
  button = document.getElementById('analyseButton');
  button.addEventListener('click', () => {button.blur(); analyseBookmarks();} );
});