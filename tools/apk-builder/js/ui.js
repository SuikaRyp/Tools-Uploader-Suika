/* ApkBuilder — ui.js (snackbar, modal, tabs, forms, uploads, preview, settings) */
        // ===== UI MODULE =====
        var UI = (function () {
          var snackbarContainer = document.getElementById("snackbarContainer");

          function showSnackbar(message, type) {
            type = type || "info";
            var icons = {
              success: "fa-circle-check",
              error: "fa-circle-xmark",
              warning: "fa-triangle-exclamation",
              info: "fa-circle-info",
            };
            var el = document.createElement("div");
            el.className = "snackbar " + type;
            el.innerHTML =
              '<i class="fa-solid ' +
              (icons[type] || icons.info) +
              '"></i><span class="msg">' +
              _escapeHtml(message) +
              "</span>";
            snackbarContainer.appendChild(el);
            setTimeout(function () {
              el.classList.add("hide");
              setTimeout(function () {
                if (el.parentNode) el.parentNode.removeChild(el);
              }, 300);
            }, 3500);
          }

          var modalOverlay = document.getElementById("modalOverlay");
          var modalTitle = document.getElementById("modalTitle");
          var modalMessage = document.getElementById("modalMessage");
          var modalConfirmBtn = document.getElementById("modalConfirm");
          var modalCancelBtn = document.getElementById("modalCancel");
          var _modalResolve = null;

          function showConfirm(title, message, confirmText) {
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            modalConfirmBtn.textContent = confirmText || "Confirm";
            modalOverlay.classList.add("open");
            return new Promise(function (resolve) {
              _modalResolve = resolve;
            });
          }

          modalConfirmBtn.addEventListener("click", function () {
            modalOverlay.classList.remove("open");
            if (_modalResolve) {
              _modalResolve(true);
              _modalResolve = null;
            }
          });
          modalCancelBtn.addEventListener("click", function () {
            modalOverlay.classList.remove("open");
            if (_modalResolve) {
              _modalResolve(false);
              _modalResolve = null;
            }
          });
          modalOverlay.addEventListener("click", function (e) {
            if (e.target === modalOverlay) {
              modalOverlay.classList.remove("open");
              if (_modalResolve) {
                _modalResolve(false);
                _modalResolve = null;
              }
            }
          });

          function _escapeHtml(text) {
            var div = document.createElement("div");
            div.appendChild(document.createTextNode(text));
            return div.innerHTML;
          }

          return {
            showSnackbar: showSnackbar,
            showConfirm: showConfirm,
            escapeHtml: _escapeHtml,
          };
        })();

        // ===== TAB NAVIGATION =====
        var tabBtns = document.querySelectorAll(".tab-btn");
        var tabPanels = document.querySelectorAll(".tab-panel");

        tabBtns.forEach(function (btn) {
          btn.addEventListener("click", function () {
            var tab = btn.getAttribute("data-tab");
            tabBtns.forEach(function (b) {
              b.classList.remove("active");
              b.setAttribute("aria-selected", "false");
            });
            tabPanels.forEach(function (p) {
              p.classList.remove("active");
            });
            btn.classList.add("active");
            btn.setAttribute("aria-selected", "true");
            var panel = document.getElementById("panel-" + tab);
            if (panel) panel.classList.add("active");
            if (tab === "preview" && appState.htmlContent) {
              refreshPreview();
            }
          });
        });

        // ===== APP STATE =====
        var appState = {
          htmlFile: null,
          htmlContent: null,
          htmlFileName: null,
          iconFile: null,
          iconDataUrl: null,
          settings: {
            autoSave: true,
            autoRefresh: true,
          },
          building: false,
        };

        // ===== FORM FIELDS =====
        var fields = {
          apkName: document.getElementById("apkName"),
          packageName: document.getElementById("packageName"),
          versionName: document.getElementById("versionName"),
          versionCode: document.getElementById("versionCode"),
          ghUsername: document.getElementById("ghUsername"),
          ghToken: document.getElementById("ghToken"),
          repoName: document.getElementById("repoName"),
          repoVisibility: document.getElementById("repoVisibility"),
        };

        // ===== AUTO-SAVE =====
        function saveFormData() {
          if (!appState.settings.autoSave) return;
          var data = {};
          Object.keys(fields).forEach(function (key) {
            if (key !== "ghToken") data[key] = fields[key].value;
          });
          Storage.setJSON("apkforge_form", data);
        }

        function loadFormData() {
          var data = Storage.getJSON("apkforge_form");
          if (!data) return;
          Object.keys(data).forEach(function (key) {
            if (fields[key] && key !== "ghToken") {
              fields[key].value = data[key];
            }
          });
        }

        function loadSettings() {
          var s = Storage.getJSON("apkforge_settings");
          if (s) {
            appState.settings.autoSave = s.autoSave !== false;
            appState.settings.autoRefresh = s.autoRefresh !== false;
          }
          updateToggle("toggleAutosave", appState.settings.autoSave);
          updateToggle("toggleAutorefresh", appState.settings.autoRefresh);
        }

        function saveSettings() {
          Storage.setJSON("apkforge_settings", appState.settings);
        }

        function updateToggle(id, on) {
          var el = document.getElementById(id);
          if (!el) return;
          if (on) {
            el.classList.add("on");
            el.setAttribute("aria-checked", "true");
          } else {
            el.classList.remove("on");
            el.setAttribute("aria-checked", "false");
          }
        }

        // Debounced auto-save
        var _saveTimer = null;
        Object.keys(fields).forEach(function (key) {
          fields[key].addEventListener("input", function () {
            clearTimeout(_saveTimer);
            _saveTimer = setTimeout(saveFormData, 500);
          });
        });

        // ===== TOKEN TOGGLE =====
        var tokenToggle = document.getElementById("tokenToggle");
        tokenToggle.addEventListener("click", function () {
          var input = fields.ghToken;
          var icon = tokenToggle.querySelector("i");
          if (input.type === "password") {
            input.type = "text";
            icon.className = "fa-solid fa-eye-slash";
          } else {
            input.type = "password";
            icon.className = "fa-solid fa-eye";
          }
        });

        // ===== ICON UPLOAD =====
        var iconUploadZone = document.getElementById("iconUploadZone");
        var iconFileInput = document.getElementById("iconFileInput");
        var iconPreview = document.getElementById("iconPreview");

        iconUploadZone.addEventListener("click", function () {
          iconFileInput.click();
        });
        iconUploadZone.addEventListener("dragover", function (e) {
          e.preventDefault();
          iconUploadZone.classList.add("dragover");
        });
        iconUploadZone.addEventListener("dragleave", function () {
          iconUploadZone.classList.remove("dragover");
        });
        iconUploadZone.addEventListener("drop", function (e) {
          e.preventDefault();
          iconUploadZone.classList.remove("dragover");
          if (e.dataTransfer.files.length > 0)
            handleIconFile(e.dataTransfer.files[0]);
        });
        iconFileInput.addEventListener("change", function () {
          if (iconFileInput.files.length > 0)
            handleIconFile(iconFileInput.files[0]);
        });

        function handleIconFile(file) {
          if (!file.type.startsWith("image/")) {
            UI.showSnackbar("Please select an image file", "error");
            return;
          }
          appState.iconFile = file;
          var reader = new FileReader();
          reader.onload = function (e) {
            appState.iconDataUrl = e.target.result;
            iconPreview.innerHTML =
              '<img src="' + e.target.result + '" alt="App Icon">';
            iconUploadZone.classList.add("has-icon");
            iconUploadZone.querySelector(".title").textContent = file.name;
            iconUploadZone.querySelector(".hint").textContent = _formatBytes(
              file.size,
            );
          };
          reader.readAsDataURL(file);
        }

        // ===== HTML FILE UPLOAD =====
        var htmlUploadZone = document.getElementById("htmlUploadZone");
        var htmlFileInput = document.getElementById("htmlFileInput");
        var htmlFileInfo = document.getElementById("htmlFileInfo");
        var htmlFileName = document.getElementById("htmlFileName");
        var htmlFileSize = document.getElementById("htmlFileSize");
        var htmlRemoveBtn = document.getElementById("htmlRemoveBtn");

        htmlUploadZone.addEventListener("click", function (e) {
          if (e.target.closest(".upload-remove")) return;
          htmlFileInput.click();
        });
        htmlUploadZone.addEventListener("dragover", function (e) {
          e.preventDefault();
          htmlUploadZone.classList.add("dragover");
        });
        htmlUploadZone.addEventListener("dragleave", function () {
          htmlUploadZone.classList.remove("dragover");
        });
        htmlUploadZone.addEventListener("drop", function (e) {
          e.preventDefault();
          htmlUploadZone.classList.remove("dragover");
          if (e.dataTransfer.files.length > 0)
            handleHtmlFile(e.dataTransfer.files[0]);
        });
        htmlFileInput.addEventListener("change", function () {
          if (htmlFileInput.files.length > 0)
            handleHtmlFile(htmlFileInput.files[0]);
        });
        htmlRemoveBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          clearHtmlFile();
        });

        function handleHtmlFile(file) {
          var ext = file.name.split(".").pop().toLowerCase();
          if (ext !== "html" && ext !== "htm") {
            UI.showSnackbar("Only .html files are accepted", "error");
            return;
          }
          appState.htmlFile = file;
          appState.htmlFileName = file.name;
          var reader = new FileReader();
          reader.onload = function (e) {
            appState.htmlContent = e.target.result;
            htmlFileName.textContent = file.name;
            htmlFileSize.textContent = _formatBytes(file.size);
            htmlFileInfo.style.display = "flex";
            htmlUploadZone.classList.add("has-file");
            UI.showSnackbar("HTML file loaded successfully", "success");
            if (appState.settings.autoRefresh) refreshPreview();
          };
          reader.readAsText(file);
        }

        function clearHtmlFile() {
          appState.htmlFile = null;
          appState.htmlContent = null;
          appState.htmlFileName = null;
          htmlFileInfo.style.display = "none";
          htmlUploadZone.classList.remove("has-file");
          htmlFileInput.value = "";
          var frame = document.getElementById("previewFrame");
          frame.style.display = "none";
          document.getElementById("previewEmpty").style.display = "flex";
          document.getElementById("previewUrl").textContent = "No file loaded";
        }

        // ===== PREVIEW =====
        function refreshPreview() {
          var frame = document.getElementById("previewFrame");
          var empty = document.getElementById("previewEmpty");
          var urlBar = document.getElementById("previewUrl");
          if (!appState.htmlContent) {
            frame.style.display = "none";
            empty.style.display = "flex";
            urlBar.textContent = "No file loaded";
            return;
          }
          empty.style.display = "none";
          frame.style.display = "block";
          urlBar.textContent = appState.htmlFileName || "preview.html";
          var blob = new Blob([appState.htmlContent], { type: "text/html" });
          var url = URL.createObjectURL(blob);
          frame.src = url;
        }

        document
          .getElementById("previewReload")
          .addEventListener("click", function () {
            refreshPreview();
            UI.showSnackbar("Preview reloaded", "info");
          });

        // ===== SETTINGS TOGGLES =====
        document
          .getElementById("toggleAutosave")
          .addEventListener("click", function () {
            appState.settings.autoSave = !appState.settings.autoSave;
            updateToggle("toggleAutosave", appState.settings.autoSave);
            saveSettings();
            UI.showSnackbar(
              "Auto-save " +
                (appState.settings.autoSave ? "enabled" : "disabled"),
              "info",
            );
          });

        document
          .getElementById("toggleAutorefresh")
          .addEventListener("click", function () {
            appState.settings.autoRefresh = !appState.settings.autoRefresh;
            updateToggle("toggleAutorefresh", appState.settings.autoRefresh);
            saveSettings();
            UI.showSnackbar(
              "Auto-refresh " +
                (appState.settings.autoRefresh ? "enabled" : "disabled"),
              "info",
            );
          });

        // ===== DANGER ZONE =====
        document
          .getElementById("btnClearData")
          .addEventListener("click", async function () {
            var yes = await UI.showConfirm(
              "Clear Saved Data",
              "This will remove all saved form data and preferences. Your current session data will remain.",
              "Clear Data",
            );
            if (yes) {
              Storage.clear();
              UI.showSnackbar("Saved data cleared", "success");
            }
          });

        document
          .getElementById("btnResetForm")
          .addEventListener("click", async function () {
            var yes = await UI.showConfirm(
              "Reset Form",
              "This will clear all form fields, uploaded files, and reset to defaults. This cannot be undone.",
              "Reset",
            );
            if (yes) {
              Object.keys(fields).forEach(function (key) {
                if (key === "versionName") fields[key].value = "1.0.0";
                else if (key === "versionCode") fields[key].value = "1";
                else if (key === "repoVisibility") fields[key].value = "public";
                else fields[key].value = "";
              });
              clearHtmlFile();
              appState.iconFile = null;
              appState.iconDataUrl = null;
              iconPreview.innerHTML = '<i class="fa-solid fa-image"></i>';
              iconUploadZone.classList.remove("has-icon");
              iconUploadZone.querySelector(".title").textContent =
                "Upload Icon";
              iconUploadZone.querySelector(".hint").textContent =
                "PNG recommended, 512×512px";
              Storage.clear();
              UI.showSnackbar("Form has been reset", "success");
            }
          });

        document
          .getElementById("clearLogsBtn")
          .addEventListener("click", function () {
            document.getElementById("logsBody").innerHTML = "";
          });

