import * as React from "react";
import { Map } from "react-leaflet";
import * as L from "leaflet"
import * as PT from "prop-types";
import "leaflet-offline";
import * as localforage from "localforage";
import greenlet from "greenlet";
import * as LeafletEsri from "esri-leaflet";

import { DOMDimensionToCss } from "./utils";
import { MapContainerProps } from "./types";
import * as stylesCss from "./styles/styles.css";
import MapAttribution from './MapAttribution';
import CenterPositionButton from './CenterPositionButton';
import MapLegend from "./MapLegend";

type LeafletContext = {
    map?: any,
    pane?: string | null,
    layerContainer?: any,
    popupContainer?: any,
}

const tilesStore = localforage.createInstance({ name: "inspection-leaflet-offline" })


type Tile = { key: string, url: string }
type TileResponse = { response: Blob, key: string }

interface ITilesStorage {
    getItem: (key: string) => Promise<{}>;
    saveTiles: (tiles: Tile[]) => Promise<{}[]>;
    clear: () => Promise<void>;
}

const getTiles = (tiles: Tile[]) => {
    function batch<T>(batchSize: number, collection: Array<T>) {
        var results = [];

        while (collection.length) {
            results.push(collection.splice(0, batchSize));
        }

        return results;
    }
    const getTile = (tile: Tile): Promise<TileResponse> => {
        return new Promise(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.open('GET', tile.url, true);
            request.responseType = 'blob';
            request.onreadystatechange = function () {
                if (request.readyState === XMLHttpRequest.DONE) {
                    if (request.status === 200) {
                        resolve({
                            response: request.response,
                            key: tile.key
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
    }
    const batchedTiles = batch(100, tiles).reduce((tasks: Promise<TileResponse[]>, tileBatch) => {
        return tasks.then((data) => {
            const newTasks = tileBatch.map(getTile)
            return Promise.all([...newTasks, ...data])
        })
    }, Promise.resolve([]))

    return batchedTiles
}

const getTilesAsync = greenlet(getTiles)

const tilesDb = {
    getItem: function (key: string) {
        return tilesStore.getItem(key);
    },

    saveTiles: function (tiles: Tile[]) {
        var self = this;
        const tasks = getTilesAsync(tiles)
            .then((res) => {
                return Promise.all(res.map(({ response, key }: TileResponse) => self._saveTile(key, response)))
            })

        return tasks
    },

    clear: function () {
        return tilesStore.clear();
    },

    _saveTile: function (key: string, value: Blob) {
        return this._removeItem(key).then(function () {
            return tilesStore.setItem(key, value);
        });
    },

    _removeItem: function (key: string) {
        return tilesStore.removeItem(key);
    }
};

const createOfflineLayerControl = (tilesDb: ITilesStorage, control: any) => {
    return control.offline(offlineLayer, tilesDb, {
        saveButtonHtml: '<i class="pf pf-save-1" aria-hidden="true"></i>',
        removeButtonHtml: '<i class="pf pf-delete" aria-hidden="true"></i>',
        confirmSavingCallback: function (nTilesToSave: number, continueSaveTiles: Function) {
            if (window.confirm('Save ' + nTilesToSave + '?')) {
                continueSaveTiles();
            }
        },
        confirmRemovalCallback: function (continueRemoveTiles: Function) {
            if (window.confirm('Remove all the tiles?')) {
                continueRemoveTiles();
            }
        },
        minZoom: 13,
        maxZoom: 19
    });
}

const createOfflineTileLayer = (tilesDb: ITilesStorage, tileLayer: any) => {
    return tileLayer.offline('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', tilesDb, {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abc',
        minZoom: 13,
        maxZoom: 19,
        crossOrigin: true
    });
}
const offlineLayer = createOfflineTileLayer(tilesDb, L.tileLayer)
const offlineControl = createOfflineLayerControl(tilesDb, L.control)
const featureLayer = new LeafletEsri.FeatureLayer({ url: "https://services.arcgis.com/V6ZHFr6zdgNZuVG0/ArcGIS/rest/services/Landscape_Trees/FeatureServer/0" })

class OfflineTileLayer extends React.Component {
    static contextTypes = {
        map: PT.any,
        layerContainer: PT.any
    }
    context: LeafletContext
    render() {
        offlineLayer.addTo(this.context.map)
        offlineControl.addTo(this.context.map)
        return (<div></div>)
    }
}

class Markers extends React.Component<{ featureLayer: any }> {

    shouldComponentUpdate() { return false }

    static contextTypes = {
        map: PT.any,
        layerContainer: PT.any
    }
    context: LeafletContext
    render() {
        this.props.featureLayer
            .query()
            .where("Native = 'NO'")
            .run((err: Error | undefined, result: { features: any[] }) => {
                result.features
                    .map(({ geometry: { coordinates: [lat, lon] } }: { geometry: { coordinates: [number, number] } }) => L.marker([lon, lat]))
                    .map((marker) => marker.addTo(this.context.map))
            })
        return (<div></div>)
    }
}

class MapContainer extends React.PureComponent<MapContainerProps> {
    render() {
        const {
            zoom,
            height,
            // onFeatureClick,
            // onPan,
            // onZoom,
            userPosition,
            // features,
            // basemapConfig
        } = this.props;
        const styles = {
            height: height ? DOMDimensionToCss(height) : ""
        }
        return (
            <div style={styles} className={`posA t0 b0 l0 r0 ${stylesCss["mT--headerHeight"]}`}>
                <Map style={styles} zoom={zoom} center={userPosition}>
                    {/* <TileLayer
                        attribution="&amp;copy <a href=&quot;http://osm.org/copyright&quot;>OpenStreetMap</a> contributors"
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    /> */}
                    <OfflineTileLayer />
                    <Markers featureLayer={featureLayer} />
                </Map>
                <MapLegend />
                <MapAttribution />
                <CenterPositionButton />
            </div>
        )
    }
}

export default MapContainer;