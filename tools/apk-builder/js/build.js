/* ApkBuilder — build.js (Cordova config gen + GitHub Actions build flow) */
        // ===== BUILD MODULE =====
        var buildStepper = document.getElementById("buildStepper");
        var buildLogs = document.getElementById("buildLogs");
        var logsBody = document.getElementById("logsBody");
        var downloadCard = document.getElementById("downloadCard");
        var buildHero = document.getElementById("buildHero");
        var buildStartBtn = document.getElementById("buildStartBtn");

        function addLog(msg, type) {
          type = type || "";
          var now = new Date();
          var time =
            String(now.getHours()).padStart(2, "0") +
            ":" +
            String(now.getMinutes()).padStart(2, "0") +
            ":" +
            String(now.getSeconds()).padStart(2, "0");
          var line = document.createElement("div");
          line.className = "log-line" + (type ? " " + type : "");
          line.innerHTML =
            '<span class="log-time">' +
            time +
            '</span><span class="log-msg">' +
            UI.escapeHtml(msg) +
            "</span>";
          logsBody.appendChild(line);
          logsBody.scrollTop = logsBody.scrollHeight;
        }

        function setStep(index, state) {
          var items = buildStepper.querySelectorAll(".step-item");
          items.forEach(function (item, i) {
            item.classList.remove("active", "completed", "error");
            var dot = item.querySelector(".step-dot");
            if (i < index) {
              item.classList.add("completed");
              dot.innerHTML =
                '<i class="fa-solid fa-check" style="font-size:12px"></i>';
            } else if (i === index) {
              item.classList.add(state || "active");
              if (state === "error") {
                dot.innerHTML =
                  '<i class="fa-solid fa-xmark" style="font-size:12px"></i>';
              } else if (state === "completed") {
                dot.innerHTML =
                  '<i class="fa-solid fa-check" style="font-size:12px"></i>';
              } else {
                dot.textContent = String(i + 1);
              }
            } else {
              dot.textContent = String(i + 1);
            }
          });
        }

        function validateForm() {
          var errors = [];
          if (!fields.apkName.value.trim()) errors.push("APK Name is required");
          if (!fields.packageName.value.trim())
            errors.push("Package Name is required");
          if (!fields.ghUsername.value.trim())
            errors.push("GitHub Username is required");
          if (!fields.ghToken.value.trim())
            errors.push("Personal Access Token is required");
          if (!fields.repoName.value.trim())
            errors.push("Repository Name is required");
          if (!appState.htmlContent) errors.push("HTML file is required");

          var pkg = fields.packageName.value.trim();
          if (pkg && !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(pkg)) {
            errors.push("Invalid package name format (use com.example.app)");
          }
          return errors;
        }

        function generateConfigXml() {
          var name = fields.apkName.value.trim();
          var pkg = fields.packageName.value.trim();
          var ver = fields.versionName.value.trim() || "1.0.0";
          var code = fields.versionCode.value.trim() || "1";

          var iconBlock = "";
          if (appState.iconDataUrl) {
            iconBlock =
              '    <icon density="ldpi" src="res/icon.png" />\n' +
              '    <icon density="mdpi" src="res/icon.png" />\n' +
              '    <icon density="hdpi" src="res/icon.png" />\n' +
              '    <icon density="xhdpi" src="res/icon.png" />\n' +
              '    <icon density="xxhdpi" src="res/icon.png" />\n' +
              '    <icon density="xxxhdpi" src="res/icon.png" />\n';
          }

          return (
            '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<widget id="' +
            pkg +
            '" version="' +
            ver +
            '" android-versionCode="' +
            code +
            '" ' +
            'xmlns="http://www.w3.org/ns/widgets" ' +
            'xmlns:cdv="http://cordova.apache.org/ns/1.0">\n' +
            "  <name>" +
            name +
            "</name>\n" +
            "  <description>Built with APK Builder</description>\n" +
            "  <author>APK Builder User</author>\n" +
            '  <content src="index.html" />\n' +
            '  <access origin="*" />\n' +
            '  <allow-intent href="http://*/*" />\n' +
            '  <allow-intent href="https://*/*" />\n' +
            '  <preference name="DisallowOverscroll" value="true" />\n' +
            '  <preference name="android-minSdkVersion" value="24" />\n' +
            '  <preference name="android-targetSdkVersion" value="34" />\n' +
            '  <preference name="Fullscreen" value="false" />\n' +
            '  <preference name="Orientation" value="default" />\n' +
            '  <platform name="android">\n' +
            '    <allow-intent href="market:*" />\n' +
            iconBlock +
            "  </platform>\n" +
            "</widget>"
          );
        }

        function generatePackageJson() {
          var name = fields.repoName.value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-");
          return JSON.stringify(
            {
              name: name,
              displayName: fields.apkName.value.trim(),
              version: fields.versionName.value.trim() || "1.0.0",
              description: "Built with APK Builder",
              main: "index.js",
              scripts: { test: 'echo "test"' },
              keywords: ["cordova", "android"],
              author: "APK Builder",
              license: "MIT",
              devDependencies: {},
              cordova: {
                platforms: [],
                plugins: {},
              },
            },
            null,
            2,
          );
        }

        var WORKFLOW_YML = `name: Build HTML to APK (Cordova Debug)

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install Cordova
        run: npm install -g cordova

      - name: Install dependencies
        run: npm install || true

      - name: Add Android platform
        run: cordova platform add android

      - name: Prepare project
        run: cordova prepare android

      - name: Build Debug APK
        run: cordova build android

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: app-debug-apk
          path: platforms/android/app/build/outputs/apk/debug/app-debug.apk
`;

        async function fileToBase64(file) {
          return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
              var result = reader.result;
              resolve(result.split(",")[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        async function startBuild() {
          if (appState.building) return;

          var errors = validateForm();
          if (errors.length > 0) {
            errors.forEach(function (e) {
              UI.showSnackbar(e, "error");
            });
            return;
          }

          appState.building = true;
          buildStartBtn.classList.add("loading");
          buildStartBtn.disabled = true;
          buildStepper.classList.add("visible");
          buildLogs.classList.add("visible");
          downloadCard.classList.remove("visible");
          logsBody.innerHTML = "";

          var username = fields.ghUsername.value.trim();
          var token = fields.ghToken.value.trim();
          var repo = fields.repoName.value.trim();
          var isPrivate = fields.repoVisibility.value === "private";

          try {
            // Step 0: Create repository
            setStep(0, "active");
            addLog("Creating GitHub repository: " + repo + "...", "info");
            await GitHub.createRepo(username, token, repo, isPrivate);
            addLog("Repository created successfully", "success");
            setStep(0, "completed");

            // Small delay to let GitHub initialize
            await _sleep(1500);

            // Step 1: Upload files
            setStep(1, "active");

            // Upload HTML
            addLog("Uploading www/index.html...");
            await GitHub.uploadFile(
              username,
              token,
              repo,
              "www/index.html",
              appState.htmlContent,
              "Add HTML source",
            );
            addLog("HTML file uploaded", "success");

            // Upload config.xml
            addLog("Uploading config.xml...");
            await GitHub.uploadFile(
              username,
              token,
              repo,
              "config.xml",
              generateConfigXml(),
              "Add Cordova config",
            );
            addLog("Config uploaded", "success");

            // Upload package.json
            addLog("Uploading package.json...");
            await GitHub.uploadFile(
              username,
              token,
              repo,
              "package.json",
              generatePackageJson(),
              "Add package.json",
            );
            addLog("Package.json uploaded", "success");

            // Upload icon if exists
            if (appState.iconFile) {
              addLog("Uploading app icon...");
              var iconBase64 = await fileToBase64(appState.iconFile);
              await GitHub.uploadFile(
                username,
                token,
                repo,
                "res/icon.png",
                iconBase64,
                "Add app icon",
                true,
              );
              addLog("Icon uploaded", "success");
            }

            // Upload workflow (this triggers GitHub Actions)
            addLog("Uploading GitHub Actions workflow...");
            await GitHub.uploadFile(
              username,
              token,
              repo,
              ".github/workflows/build.yml",
              WORKFLOW_YML,
              "Add build workflow",
            );
            addLog(
              "Workflow uploaded — build will trigger automatically",
              "success",
            );

            setStep(1, "completed");

            // Step 2: Trigger / Wait for Actions
            setStep(2, "active");
            addLog("Waiting for GitHub Actions to start...", "info");
            await _sleep(5000);

            var runId = null;
            var maxAttempts = 20;
            for (var a = 0; a < maxAttempts; a++) {
              var runsData = await GitHub.getWorkflowRuns(
                username,
                token,
                repo,
              );
              if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
                runId = runsData.workflow_runs[0].id;
                addLog("Workflow run detected: #" + runId, "success");
                break;
              }
              addLog(
                "Waiting for workflow to start... (attempt " + (a + 1) + ")",
              );
              await _sleep(5000);
            }

            if (!runId) {
              throw new Error(
                "GitHub Actions workflow did not start after multiple attempts. Check your repository settings.",
              );
            }

            setStep(2, "completed");

            // Step 3: Monitor build
            setStep(3, "active");
            addLog("Monitoring build progress...", "info");

            var completed = false;
            var pollCount = 0;
            var maxPolls = 120; // ~10 minutes
            while (!completed && pollCount < maxPolls) {
              pollCount++;
              await _sleep(5000);
              var run = await GitHub.getWorkflowRun(
                username,
                token,
                repo,
                runId,
              );
              var status = run.status;
              var conclusion = run.conclusion;

              if (pollCount % 6 === 0) {
                addLog(
                  "Build in progress... (" +
                    Math.floor((pollCount * 5) / 60) +
                    "m " +
                    ((pollCount * 5) % 60) +
                    "s elapsed)",
                );
              }

              if (status === "completed") {
                completed = true;
                if (conclusion === "success") {
                  addLog("Build completed successfully!", "success");
                  setStep(3, "completed");

                  // Step 4: Get artifact
                  setStep(4, "active");
                  addLog("Fetching build artifact...", "info");
                  await _sleep(2000);
                  var artifacts = await GitHub.getArtifacts(
                    username,
                    token,
                    repo,
                    runId,
                  );
                  if (artifacts.artifacts && artifacts.artifacts.length > 0) {
                    var artifact = artifacts.artifacts[0];
                    addLog(
                      "Artifact found: " +
                        artifact.name +
                        " (" +
                        _formatBytes(artifact.size_in_bytes) +
                        ")",
                      "success",
                    );
                    var artifactUrl =
                      "https://github.com/" +
                      username +
                      "/" +
                      repo +
                      "/actions/runs/" +
                      runId;
                    
                    var downloadLinkEl =
                      document.getElementById("downloadLink");
                    // set link utama
                    downloadLinkEl.href = artifactUrl;
                    
                    downloadCard.classList.add("visible");
                    setStep(4, "completed");
                    addLog(
                      "Build process complete! Your APK is ready.",
                      "success",
                    );
                    UI.showSnackbar("APK build successful!", "success");
                  } else {
                    addLog(
                      "No artifacts found. The build may have completed without producing an APK.",
                      "error",
                    );
                    var fallbackUrl =
                      "https://github.com/" +
                      username +
                      "/" +
                      repo +
                      "/actions/runs/" +
                      runId;
                    document.getElementById("downloadLink").href = fallbackUrl;
                    downloadCard.classList.add("visible");
                    setStep(4, "completed");
                  }
                } else {
                  addLog(
                    "Build failed with conclusion: " + conclusion,
                    "error",
                  );
                  setStep(3, "error");
                  UI.showSnackbar("Build failed: " + conclusion, "error");
                  var failUrl =
                    "https://github.com/" +
                    username +
                    "/" +
                    repo +
                    "/actions/runs/" +
                    runId;
                  addLog("View details: " + failUrl, "info");
                }
              }
            }

            if (!completed) {
              addLog(
                "Build monitoring timed out. Check GitHub Actions for status.",
                "warning",
              );
              setStep(3, "error");
              var timeoutUrl =
                "https://github.com/" + username + "/" + repo + "/actions";
              addLog("View at: " + timeoutUrl, "info");
              UI.showSnackbar("Build monitoring timed out", "warning");
            }
          } catch (err) {
            addLog("Error: " + err.message, "error");
            UI.showSnackbar(err.message, "error");
            // Mark current active step as error
            var activeStep = buildStepper.querySelector(".step-item.active");
            if (activeStep) {
              var idx = parseInt(activeStep.getAttribute("data-step"), 10);
              setStep(idx, "error");
            }
          } finally {
            appState.building = false;
            buildStartBtn.classList.remove("loading");
            buildStartBtn.disabled = false;
          }
        }

        buildStartBtn.addEventListener("click", startBuild);

        // ===== UTILITIES =====
        function _formatBytes(bytes) {
          if (bytes === 0) return "0 B";
          var k = 1024;
          var sizes = ["B", "KB", "MB", "GB"];
          var i = Math.floor(Math.log(bytes) / Math.log(k));
          return (
            parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
          );
        }

        function _sleep(ms) {
          return new Promise(function (resolve) {
            setTimeout(resolve, ms);
          });
        }

        // ===== INIT =====
        loadSettings();
        loadFormData();
