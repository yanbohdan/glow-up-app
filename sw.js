/*
 * Service Worker for "My Glow training programme".
 * Same real (non-simulated) caching strategy as the original app:
 *  - Precaches the app shell on install.
 *  - Network-first for navigations (so index.html updates load instantly
 *    when online), with cache/offline fallback when offline.
 *  - Cache-first for other assets (icons, manifest, fonts CSS).
 *  - Cleans up old caches on activate; new versions wait for the
 *    in-app "Оновити" confirmation before taking over.
 *
 * Bump CACHE_VERSION whenever you change any precached asset (icons,
 * manifest, offline.html) so returning users get the fresh copy.
 */
"use strict";

var CACHE_VERSION = "v2";
var CACHE_NAME = "glow-cache-" + CACHE_VERSION;

var APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./offline.html",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return Promise.all(
        APP_SHELL.map(function(url){
          return cache.add(url).catch(function(){ /* ignore single-file failures */ });
        })
      );
    })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(key){ return key !== CACHE_NAME; })
            .map(function(key){ return caches.delete(key); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("message", function(event){
  if(event.data && event.data.type === "SKIP_WAITING"){
    self.skipWaiting();
  }
});

function isNavigationRequest(request){
  return request.mode === "navigate" ||
    (request.method === "GET" && request.headers.get("accept") && request.headers.get("accept").indexOf("text/html") !== -1);
}

self.addEventListener("fetch", function(event){
  var request = event.request;
  if(request.method !== "GET") return;

  if(isNavigationRequest(request)){
    event.respondWith(
      fetch(request).then(function(response){
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put("./index.html", copy); });
        return response;
      }).catch(function(){
        return caches.match(request).then(function(cached){
          return cached || caches.match("./index.html").then(function(shell){
            return shell || caches.match("./offline.html");
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function(cached){
      if(cached) return cached;
      return fetch(request).then(function(response){
        if(response && response.status === 200){
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(request, copy); });
        }
        return response;
      }).catch(function(){
        return caches.match("./offline.html");
      });
    })
  );
});
