/* ApkBuilder — storage.js (dark mode + localStorage helper) */
        // ===== DARK MODE DETECTION =====
        if (
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
        ) {
          document.documentElement.classList.add("dark");
        }
        window
          .matchMedia("(prefers-color-scheme: dark)")
          .addEventListener("change", function (event) {
            if (event.matches) {
              document.documentElement.classList.add("dark");
            } else {
              document.documentElement.classList.remove("dark");
            }
          });

        // ===== STORAGE MODULE =====
        var Storage = (function () {
          var memStore = {};

          function _tryLocal(method, key, value) {
            if (method === "get") return memStore[key] || null;
            if (method === "set") memStore[key] = value;
            if (method === "remove") delete memStore[key];
            if (method === "clear") memStore = {};
          }

          return {
            get: function (k) {
              return _tryLocal("get", k);
            },
            set: function (k, v) {
              _tryLocal("set", k, String(v));
            },
            remove: function (k) {
              _tryLocal("remove", k);
            },
            clear: function () {
              _tryLocal("clear");
            },
            getJSON: function (k) {
              var raw = _tryLocal("get", k);
              if (!raw) return null;
              try {
                return JSON.parse(raw);
              } catch (_e) {
                return null;
              }
            },
            setJSON: function (k, v) {
              _tryLocal("set", k, JSON.stringify(v));
            },
          };
        })();

