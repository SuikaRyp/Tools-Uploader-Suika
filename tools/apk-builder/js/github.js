/* ApkBuilder — github.js (GitHub REST API calls) */
        // ===== GITHUB MODULE =====
        var GitHub = (function () {
          var API_BASE = "https://api.github.com";

          function _headers(token) {
            return {
              Authorization: "Bearer " + token,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
              "Content-Type": "application/json",
            };
          }

          async function createRepo(username, token, repoName, isPrivate) {
            var res = await fetch(API_BASE + "/user/repos", {
              method: "POST",
              headers: _headers(token),
              body: JSON.stringify({
                name: repoName,
                private: isPrivate,
                auto_init: false,
                description: "Android APK built with APK Builder",
              }),
            });

            if (!res.ok) {
              var err = await res.json().catch(function () {
                return {};
              });
              throw new Error(
                err.message ||
                  "Failed to create repository (HTTP " + res.status + ")",
              );
            }

            return res.json();
          }

          // FIXED uploadFile (support binary)
          async function uploadFile(
            username,
            token,
            repo,
            path,
            content,
            message,
            isBinary,
          ) {
            var base64Content;

            if (isBinary) {
              // content sudah base64 dari FileReader
              base64Content = content;
            } else {
              // encode teks biasa
              base64Content = btoa(unescape(encodeURIComponent(content)));
            }

            var res = await fetch(
              API_BASE +
                "/repos/" +
                username +
                "/" +
                repo +
                "/contents/" +
                path,
              {
                method: "PUT",
                headers: _headers(token),
                body: JSON.stringify({
                  message: message || "Add " + path,
                  content: base64Content,
                }),
              },
            );

            if (!res.ok) {
              var err = await res.json().catch(function () {
                return {};
              });
              throw new Error(
                err.message ||
                  "Failed to upload " + path + " (HTTP " + res.status + ")",
              );
            }

            return res.json();
          }

          async function getWorkflowRuns(username, token, repo) {
            var res = await fetch(
              API_BASE +
                "/repos/" +
                username +
                "/" +
                repo +
                "/actions/runs?per_page=1",
              {
                headers: _headers(token),
              },
            );
            if (!res.ok) throw new Error("Failed to fetch workflow runs");
            return res.json();
          }

          async function getWorkflowRun(username, token, repo, runId) {
            var res = await fetch(
              API_BASE +
                "/repos/" +
                username +
                "/" +
                repo +
                "/actions/runs/" +
                runId,
              {
                headers: _headers(token),
              },
            );
            if (!res.ok) throw new Error("Failed to fetch workflow run status");
            return res.json();
          }

          async function getArtifacts(username, token, repo, runId) {
            var res = await fetch(
              API_BASE +
                "/repos/" +
                username +
                "/" +
                repo +
                "/actions/runs/" +
                runId +
                "/artifacts",
              {
                headers: _headers(token),
              },
            );
            if (!res.ok) throw new Error("Failed to fetch artifacts");
            return res.json();
          }

          return {
            createRepo: createRepo,
            uploadFile: uploadFile,
            getWorkflowRuns: getWorkflowRuns,
            getWorkflowRun: getWorkflowRun,
            getArtifacts: getArtifacts,
          };
        })();


