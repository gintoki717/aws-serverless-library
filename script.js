var API_BASE = "https://szpo4xcaqj.execute-api.us-east-1.amazonaws.com/prod";

// 兼容性更好的请求实现（优先使用 XMLHttpRequest，因为 Kindle 更兼容）
function makeRequest(url, callback) {
  try {
    // 优先使用 XMLHttpRequest（Kindle 等旧浏览器更兼容）
    if (typeof XMLHttpRequest !== "undefined") {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.setRequestHeader("Accept", "application/json");
      
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || xhr.status === 0) {
            try {
              var data = JSON.parse(xhr.responseText);
              callback(null, data);
            } catch (e) {
              callback(new Error("解析响应失败"), null);
            }
          } else if (xhr.status > 0) {
            callback(new Error("HTTP " + xhr.status), null);
          } else {
            callback(new Error("网络错误"), null);
          }
        }
      };
      
      xhr.onerror = function() {
        callback(new Error("网络错误"), null);
      };
      
      try {
        xhr.send();
      } catch (e) {
        callback(new Error("发送请求失败"), null);
      }
    } else if (typeof fetch !== "undefined") {
      // 备用：使用 fetch（现代浏览器）
      fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      })
      .then(function(res) {
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        return res.json();
      })
      .then(function(data) {
        callback(null, data);
      })
      .catch(function(err) {
        callback(err, null);
      });
    } else {
      callback(new Error("浏览器不支持网络请求"), null);
    }
  } catch (e) {
    callback(new Error("请求异常：" + e.message), null);
  }
}

function loadBooks() {
  var statusText = document.getElementById("status-text");
  var loadBtn = document.getElementById("load-btn");
  var booksContainer = document.getElementById("books");
  
  if (!statusText || !loadBtn || !booksContainer) {
    alert("页面元素加载失败，请刷新页面重试");
    return;
  }
  
  try {
    statusText.textContent = "正在从云端加载书籍…";
    statusText.className = "status-text";
    if (loadBtn) {
      loadBtn.disabled = true;
    }

    makeRequest(API_BASE + "/books", function(err, data) {
      if (err) {
        if (statusText) {
          statusText.textContent = "加载失败：" + err.message;
          statusText.className = "status-text error";
        }
        if (loadBtn) {
          loadBtn.disabled = false;
        }
        return;
      }

      if (!booksContainer) {
        return;
      }

      booksContainer.innerHTML = "";

      if (!data || !data.length || data.length === 0) {
        if (statusText) {
          statusText.textContent = "没有查询到任何书籍，可以先在后台添加几本。";
        }
        if (loadBtn) {
          loadBtn.disabled = false;
        }
        return;
      }

      if (statusText) {
        statusText.textContent = "已加载 " + data.length + " 本书。";
      }

      for (var i = 0; i < data.length; i++) {
        var book = data[i];
        if (!book) continue;
        
        var div = document.createElement("article");
        if (div) {
          div.className = "book";

          var bookId = (book.BookId || book.bookId || book.id || "").toString();
          var title = (book.Title || book.title || "未命名书籍").toString();
          var author = (book.Author || book.author || "佚名").toString();
          var desc = (book.Description || book.description || "暂无简介。").toString();

          // 转义特殊字符，防止 XSS
          bookId = bookId.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
          title = title.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;");
          author = author.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;");
          desc = desc.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;");

          div.innerHTML = 
            '<div class="book-header">' +
              '<div class="book-info">' +
                '<h3>' + title + '</h3>' +
                '<p class="book-meta">作者 · ' + author + '</p>' +
                '<p class="book-desc">' + desc + '</p>' +
              '</div>' +
              '<button class="download-btn" onclick="downloadBook(\'' + bookId + '\')" title="下载书籍">' +
                '<span class="download-icon">⬇</span>' +
                '<span class="download-text">下载</span>' +
              '</button>' +
            '</div>';

          booksContainer.appendChild(div);
        }
      }
      
      if (loadBtn) {
        loadBtn.disabled = false;
      }
    });
  } catch (e) {
    if (statusText) {
      statusText.textContent = "加载异常：" + e.message;
      statusText.className = "status-text error";
    }
    if (loadBtn) {
      loadBtn.disabled = false;
    }
  }
}

// 手动实现 URL 编码（兼容 Kindle）
function encodeUrlComponent(str) {
  if (typeof encodeURIComponent !== "undefined") {
    return encodeURIComponent(str);
  }
  // 手动编码（兼容旧浏览器）
  var result = "";
  for (var i = 0; i < str.length; i++) {
    var char = str.charAt(i);
    if (/[a-zA-Z0-9\-_.!~*'()]/.test(char)) {
      result += char;
    } else {
      var code = str.charCodeAt(i);
      if (code < 128) {
        result += "%" + code.toString(16).toUpperCase();
      } else {
        result += encodeURI(char);
      }
    }
  }
  return result;
}

function downloadBook(bookId) {
  var statusText = document.getElementById("status-text");
  
  if (!bookId) {
    if (statusText) {
      statusText.textContent = "错误：书籍 ID 不存在";
      statusText.className = "status-text error";
    }
    return;
  }

  // 手动编码 bookId，避免使用可能不支持的 encodeURIComponent
  var encodedId = encodeUrlComponent(bookId);
  var url = API_BASE + "/books/" + encodedId + "/download";

  makeRequest(url, function(err, data) {
    if (err) {
      if (statusText) {
        statusText.textContent = "下载失败：" + err.message;
        statusText.className = "status-text error";
      }
      return;
    }

    var downloadUrl = data && data.download_url;

    if (!downloadUrl) {
      if (statusText) {
        statusText.textContent = "下载失败：服务器未返回下载链接";
        statusText.className = "status-text error";
      }
      return;
    }

    // 🔥 核心：直接跳转到 presigned URL（在移动设备和浏览器上都更可靠）
    try {
      window.location.href = downloadUrl;
    } catch (e) {
      if (statusText) {
        statusText.textContent = "跳转失败，请手动访问链接";
        statusText.className = "status-text error";
      }
    }
  });
}

