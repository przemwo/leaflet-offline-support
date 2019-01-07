'use strict';

// zwraca [][]
const batch = (batchSize, [...collection]) => {
    const result = [];
    while (collection.length) {
        result.push(collection.splice(0, batchSize));
    }
    return result;
};
// zwraca Promise: { key, response }
// TODO: refactor to use fetch?
const getTile = ({
    key,
    url
}) => {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'blob';
        request.onreadystatechange = function () {
            if (request.readyState === XMLHttpRequest.DONE) {
                if (request.status === 200) {
                    resolve({
                        key,
                        response: request.response
                    });
                } else {
                    reject({
                        status: request.status,
                        statusText: request.statusText
                    });
                }
            }
        };
        request.send();
    });
};
// TODO: opakuj getTiles w greenlet
const getTiles = (tiles) => {
    // podziel tiles na tablice tablic
    const batchedTiles = batch(3, tiles);
    // sekwencyjnie pobieraj dane z batchedTiles
    return batchedTiles.reduce((tilesDataPromises, tileBatch) => {
        return tilesDataPromises.then((tilesData) => {
            const tileBatchPromises = tileBatch.map(getTile);
            return Promise.all([
                ...tilesData,
                ...tileBatchPromises
            ]);
        });
    }, Promise.resolve([]));
};
var tilesDb = {
    getItem: function (key) {
        return localforage.getItem(key);
    },
    saveTiles: function (tileUrls) {
        return getTiles(tileUrls).then((tilesData) => {
            // zapisz do localstorage
            const tileToSavePromises = tilesData.map(({
                key,
                response
            }) => this._saveTile(key, response));
            return Promise.all(tileToSavePromises);
        });
    },
    clear: function () {
        return localforage.clear();
    },
    _saveTile: function (key, value) {
        return this._removeItem(key).then(function () {
            return localforage.setItem(key, value);
        });
    },
    _removeItem: function (key) {
        return localforage.removeItem(key);
    }
};

var map = L.map('map-id');
var offlineLayer = L.tileLayer.offline('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', tilesDb, {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: 'abc',
    minZoom: 13,
    maxZoom: 19,
    crossOrigin: true
});
var offlineControl = L.control.offline(offlineLayer, tilesDb, {
    saveButtonHtml: '<i class="fa fa-download" aria-hidden="true"></i>',
    removeButtonHtml: '<i class="fa fa-trash" aria-hidden="true"></i>',
    confirmSavingCallback: function (nTilesToSave, continueSaveTiles) {
        if (window.confirm('Save ' + nTilesToSave + '?')) {
            continueSaveTiles();
        }
    },
    confirmRemovalCallback: function (continueRemoveTiles) {
        if (window.confirm('Remove all the tiles?')) {
            continueRemoveTiles();
        }
    },
    minZoom: 14,
    maxZoom: 19
});

offlineLayer.addTo(map);
offlineControl.addTo(map);

offlineLayer.on('offline:below-min-zoom-error', function () {
    alert('Can not save tiles below minimum zoom level.');
});

offlineLayer.on('offline:save-start', function (data) {
    console.log('Saving ' + data.nTilesToSave + ' tiles.');
});

offlineLayer.on('offline:save-end', function () {
    alert('All the tiles were saved.');
});

offlineLayer.on('offline:save-error', function (err) {
    console.error('Error when saving tiles: ' + err);
});

offlineLayer.on('offline:remove-start', function () {
    console.log('Removing tiles.');
});

offlineLayer.on('offline:remove-end', function () {
    alert('All the tiles were removed.');
});

offlineLayer.on('offline:remove-error', function (err) {
    console.error('Error when removing tiles: ' + err);
});

map.setView([54.3610063, 18.549947], 19);

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!
// Pobieranie url dla danego obszaru. Nastepnie mozna te url wykorzystac do pobierania i zapisywania tiles :)
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!
const currentZoom = map.getZoom();
const latlngBounds = map.getBounds();
const bounds = L.bounds(map.project(latlngBounds.getNorthWest(), currentZoom), map.project(latlngBounds.getSouthEast(), currentZoom));
console.log(bounds);
const tileBounds = L.bounds(
    bounds.min.divideBy(offlineLayer.getTileSize().x).floor(),
    bounds.max.divideBy(offlineLayer.getTileSize().x).floor()
);


offlineLayer.getTileUrl(new L.Point(tileBounds.min.x, tileBounds.min.y + 1)).then((url) => console.log(url));
offlineLayer.getTileUrl(new L.Point(tileBounds.min.x + 1, tileBounds.min.y + 1)).then((url) => console.log(url));
offlineLayer.getTileUrl(new L.Point(tileBounds.min.x + 2, tileBounds.min.y + 1)).then((url) => console.log(url));

// setTimeout(() => {
//     offlineControl._saveTiles();

// }, 3000);


// // Markers LatLng
// const markersLatLng = [
//     [54.3610063, 18.549947],
//     [54.0, 18.0],
//     [53.0, 19.0],
// ];

// const foo = L.latLngBounds(markersLatLng);
// // console.log(foo.getCenter());

// const map = L.map("map", {
//     center: [54.3610063, 18.549947], // lat, lng
//     zoom: 10,
//     //   maxBounds: markersLatLng,
// });

// // Event listeners
// const logEventType = (e) => console.log('EVENT: ', e.type);
// const handleLocationFound = (e) => {
//     logEventType(e);
//     console.log(e);
// };
// map.on("load", logEventType);
// map.on("viewreset", logEventType);
// map.on("layeradd", logEventType);
// map.on("moveend", logEventType);
// map.on('locationfound', handleLocationFound);

// const layer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
// });

// layer.on("tileloadstart", () => {
//     console.log(111);
// });

// const markers = markersLatLng.map((markerLatLng) => L.marker(markerLatLng));

// markers.forEach((marker) => {
//     map.addLayer(marker);
// });

// map.addLayer(layer);

// setTimeout(() => {
//     map.fitBounds(foo, {
//     });
// }, 3000);

// setTimeout(() => {
//     map.locate({
//         setView: true,
//     });
//     console.log(map.getPixelBounds());
// }, 5000);

// console.log(map.getPixelOrigin());
// console.log(map.getPixelBounds());
// console.log(map.getPixelWorldBounds());
// console.log(layer)