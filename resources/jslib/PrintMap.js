OpenLayers.Control.ModifyFeature.prototype.collectRadiusHandle = function() {
        var geometry = this.feature.geometry;
        var bounds = geometry.getBounds();
        var center = bounds.getCenterLonLat();
        var originGeometry = new OpenLayers.Geometry.Point(
            center.lon, center.lat
        );
        var radiusGeometry = new OpenLayers.Geometry.Point(
            bounds.right, bounds.bottom
        );
        var radius = new OpenLayers.Feature.Vector(radiusGeometry);
        // **** GeoNote Hack; todo: find a better method
        if (this.feature.attributes.color || this.feature.attributes.label || this.feature.attributes.attach) {
            radius.attributes.label = '';
            radius.attributes.color = '#ee9900';
            radius.attributes.attach = '';
        }
        var resize = (this.mode & OpenLayers.Control.ModifyFeature.RESIZE);
        var reshape = (this.mode & OpenLayers.Control.ModifyFeature.RESHAPE);
        var rotate = (this.mode & OpenLayers.Control.ModifyFeature.ROTATE);
        var self = this;

        radiusGeometry.move = function(x, y) {
            OpenLayers.Geometry.Point.prototype.move.call(this, x, y);
            var dx1 = this.x - originGeometry.x;
            var dy1 = this.y - originGeometry.y;
            var dx0 = dx1 - x;
            var dy0 = dy1 - y;
            if(rotate) {
                var a0 = Math.atan2(dy0, dx0);
                var a1 = Math.atan2(dy1, dx1);
                var angle = a1 - a0;
                angle *= 180 / Math.PI;
                geometry.rotate(angle, originGeometry);
                self.pageRotation+= angle;
                if (self.pageRotation > 360) self.pageRotation-=360;
            }
            if(resize) {
                var scale, ratio;
                // 'resize' together with 'reshape' implies that the aspect
                // ratio of the geometry will not be preserved whilst resizing
                if (reshape) {
                    scale = dy1 / dy0;
                    ratio = (dx1 / dx0) / scale;
                } else {
                    var l0 = Math.sqrt((dx0 * dx0) + (dy0 * dy0));
                    var l1 = Math.sqrt((dx1 * dx1) + (dy1 * dy1));
                    scale = l1 / l0;
                }
                geometry.resize(scale, originGeometry, ratio);
            }
        };
        radius._sketch = true;
        this.radiusHandle = radius;
        this.layer.addFeatures([this.radiusHandle], {silent: true});
    }

OpenLayers.Control.PrintMap = OpenLayers.Class(OpenLayers.Control, {
    //type: OpenLayers.Control.TYPE_TOGGLE,
    formId: null, //id del form di stampa
    loadingControl: null,
    baseUrl:null,
    offsetLeft:0, //pannelli che se aperti riducono l'area della mappa
    offsetRight:0,
    offsetTop:0,
    offsetBottom:0,
    margin: 25,
    pageFormat:"A4", //controlli
    pageLayout:"vertical",
    printFormat:"HTML",
    boxScale:null,
    printLegend:0,
    printResolution:150,
    printDate:null,
    printText:null,
    northArrow:null,
    maxScale:null,
    layerBox:null,
    allowDrag:false,
    allowResize:false,
    allowRotation:false,
    autoCenter:false,
    styleBox:null,

    defaultTemplateHTML: null,
    defaultTemplatePDF: null,
    templates: [],
    template: null,
    defaultLayers: [],
    waitFor: undefined,//se il pannello viene caricato async, il tool aspetta il caricamento prima di far partire la richiesta per il box

    EVENT_TYPES: ["activate","deactivate","panelready","updateboxInfo","printed"],

    pages: null,

    initialize: function(options) {
        OpenLayers.Control.prototype.initialize.apply(this, arguments);
    },

    doPrint: function() {
        var me = this;
        var params = me.getParams();
        params["tiles"] = me.getTiles();
        params["vectors"] = me.getVectors();
        params["vectors_srid"] = this.map.projection;
        params["format"] = me.printFormat;
        params["printFormat"] = me.pageFormat;
        params["legend"] = me.printLegend;
        params["direction"] = me.pageLayout;
        params["dpi"] = me.printResolution;
        params["northArrow"] = me.northArrow;
        params["rotation"] = me.modifyControl.pageRotation;
        params["text"] = me.printText;
        params["date"] = me.printDate;
        params["scale"] = me.boxScale;
        params["map"] = me.map.config.mapsetName;

        if (this.template) {
            params['template'] = this.template;
        }
        else {
            if (me.printFormat == 'HTML' && this.defaultTemplateHTML)
                params['template'] = this.defaultTemplateHTML;
            else if (me.printFormat == 'PDF' && this.defaultTemplatePDF)
                params['template'] = this.defaultTemplatePDF;
        }

        var bounds = me.printBox.geometry.getBounds().clone();
        var center = bounds.getCenterLonLat();

        if (this.map.displayProjection && this.map.displayProjection != this.map.projection) {
            var boxW = this.pageW*this.boxScale/100;
            var boxH = this.pageH*this.boxScale/100;
            var projCOK = new OpenLayers.Projection(this.map.displayProjection);
            center.transform(this.map.getProjectionObject(), projCOK);
            bounds = new OpenLayers.Bounds(center.lon - boxW/2, center.lat - boxH/2, center.lon + boxW/2,  center.lat + boxH/2);
        }

        var width = bounds.getWidth();
        var height = bounds.getHeight();

        params["center"] = [center.lon, center.lat];
        params["extent"] = [center.lon-width/2,center.lat-height/2,center.lon+width/2,center.lat+height/2].join(",");

        if(me.loadingControl) me.loadingControl.maximizeControl();

         $.ajax({
            url: me.baseUrl + '/services/print.php',
            type: 'POST',
            data: params,
            dataType: 'json',
            success: function(response) {

                if(typeof(response.result) != 'undefined' && response.result == 'ok') {
                    me.events.triggerEvent("printed", response);
                }
                else {
                    alert(OpenLayers.i18n('Error'));
                }
                if(me.loadingControl) me.loadingControl.minimizeControl();
            },
            error: function() {
                alert(OpenLayers.i18n('Error'));
                if(me.loadingControl) me.loadingControl.minimizeControl();
            }
        });
    },

    setMap: function(map) {

        //si può spostare in initialize quando togliamo i parametri che dipendono da map


        var me = this;

        OpenLayers.Control.prototype.setMap.apply(me, arguments);

        if(!me.loadingControl) {
            var query = me.map.getControlsByClass('OpenLayers.Control.LoadingPanel');
            if(query.length) me.loadingControl = query[0];
        }

        this.layerbox = new OpenLayers.Layer.Vector("LayerBox",{styleMap:me.styleBox});
        this.map.addLayer(this.layerbox);

        if(this.allowDrag || this.allowResize || this.allowRotate){
            this.modifyControl = new OpenLayers.Control.ModifyFeature(this.layerbox);
            this.map.addControl(this.modifyControl);
            this.layerbox.events.register('featuremodified', this, this.onBoxModify);
        }

        var params = this.getParams();
        params.request_type = 'get-box';
        $.ajax({
            url: me.baseUrl + '/services/print.php',
            jsonpCallback: "callback",
            async: false,
            type: 'POST',
            dataType: 'jsonp',
            data: params,
            success: function(response) {

                if(typeof(response) != 'object' || response == null || typeof(response.result) != 'string' || response.result != 'ok' || typeof(response.pages) != 'object') {
                    return alert(OpenLayers.i18n('System error'));
                }
                me.pages = response.pages;
                me.templates = response.templates;

                if (!me.eventListeners.deactivate)
                    me.events.register('deactivate', me, me.removePrintBox);
                if (!me.eventListeners.activate)
                    me.events.register('activate', me, me.drawPrintBox);
                //me.drawPrintBox.apply(me);
                me.events.triggerEvent("updateboxInfo");

            },
            error: function() {
                return alert(OpenLayers.i18n('System error'));
            }
        });


    },

    getParams: function() {
        var self = this;

        var size  = this.map.getCurrentSize();
        var center = this.map.getCenter();
        var copyrightString = null;
        var searchControl = this.map.getControlsByClass('OpenLayers.Control.Attribution');
        if(searchControl.length > 0) {
            copyrightString = searchControl[0].div.innerText;
        }

        var srid;
        var extent = this.map.calculateBounds();
        if (this.map.displayProjection && this.map.displayProjection != this.map.projection) {
            var projCOK = new OpenLayers.Projection(this.map.displayProjection);
            center.transform(this.map.getProjectionObject(), projCOK);
            extent.transform(this.map.getProjectionObject(), projCOK);
            srid = this.map.displayProjection;
        }
        else {
            srid = this.map.getProjection();
        }
        if(srid == 'EPSG:900913') srid = 'EPSG:3857';

        params = {
            viewport_size: [size.w, size.h],
            center: [center.lon, center.lat],
            srid: srid,
            copyrightString: copyrightString,
            extent: extent.toBBOX() //Non serve ma me lo chiede da vedere
        }

        return params;
    },

    getVectors: function() {
        var vector, vectors = [];
        var self = this;
        var gcConfig = this.map.config;

        var layers = this.map.layers;

        $.each(layers, function(key, layer) {
            if (layer.getVisibility() && layer.CLASS_NAME == 'OpenLayers.Layer.Vector' && layer.name != 'LayerBox') {

                var WKTConvert = new OpenLayers.Format.WKT();

                for (var i=0; i<layer.features.length; i++) {
                    // TODO: check if geometry intersects the print box
                    var layerGeom = layer.features[i].geometry;
                    var txtGeom = WKTConvert.extractGeometry(layerGeom);
                    var typeGeom = layerGeom.CLASS_NAME.replace('OpenLayers.Geometry.', '');

                    // **** Get additional style data
                    // **** Use a parametric SDL ad hoc in Gisclient
                    // **** to render dynamic styles on vectors
                    var currentStyle = layer.styleMap.styles[layer.features[i].renderIntent].defaultStyle;

                    vector = {
                        type: typeGeom,
                        geometry: txtGeom,
                    };

                    if (layer.features[i].attributes.hasOwnProperty('printoptions')) {
                        vector.printoptions = layer.features[i].attributes.printoptions;
                    }

                    var styleFields = Object.keys(currentStyle);
                    for (var k=0; k<styleFields.length; k++) {
                        var styleField = styleFields[k];
                        var styleContent = currentStyle[styleField];
                        if (typeof styleContent === 'string' && styleContent.match(/^\$\{.*\}$/) !== null) {
                            var attrName = styleContent.substring(2, styleContent.length-1);
                            vector[styleField.toLowerCase()] = layer.features[i].attributes[attrName];
                        }
                        else {
                            vector[styleField.toLowerCase()] = styleContent;
                        }

                        // **** Mapserver compatibility - Adjust some style values
                        if (styleField.indexOf('Color') >= 0) {
                            // **** Javscript color
                            var ctx = document.createElement('canvas').getContext('2d');
                            ctx.fillStyle = vector[styleField.toLowerCase()];
                            vector[styleField.toLowerCase()] = ctx.fillStyle;
                        }
                        if (styleField.indexOf('Opacity') >= 0 && vector[styleField.toLowerCase()]) {
                            vector[styleField.toLowerCase()] = vector[styleField.toLowerCase()]*100;
                        }
                        if (styleField == 'fontSize' && vector[styleField.toLowerCase()]) {
                            vector[styleField.toLowerCase()] = (vector[styleField.toLowerCase()]).replace('px','');
                        }
                        if (styleField == 'externalGraphic' && vector[styleField.toLowerCase()] && (vector[styleField.toLowerCase()]).substring(0,4) != 'http') {
                            vector[styleField.toLowerCase()] = window.location.origin + vector[styleField.toLowerCase()];
                        }
                        if (styleField == 'angle' || styleField == 'rotation') {
                            vector[styleField.toLowerCase()] = 360-vector[styleField.toLowerCase()];
                        }
                    }

                    vectors.push(vector);
                }
            }
        });

        return vectors;
    },

    getTiles: function(){

        var tile,tiles = [];
        var self = this;
        var gcConfig = this.map.config;

        var layers = this.map.layers;
        var mapsetTilesActive = false;

        if (GisClientMap.mapsetTiles){
            if (GisClientMap.mapsetTileLayer.getVisibility()) {
                mapsetTilesActive = true;
                layers = self.defaultLayers;
            }
        }

        $.each(layers, function(key, layer) {
            if (!layer.getVisibility() && !mapsetTilesActive) return;
            //if (!layer.calculateInRange()) return;
            var layerWMS = layer.map.getLayersByName(layer.name.replace(/_tiles$/,'')) && layer.map.getLayersByName(layer.name.replace(/_tiles$/,''))[0];
            if (layerWMS && layer.name != layerWMS.name) {
                layerWMS.params['LAYERS'] = layer.params['LAYERS'];
                layer = layerWMS;
            }
            var tile;
            var layerUrl = layer.url;
            if(layer.owsurl) layerUrl = layer.owsurl;
            if(layer.CLASS_NAME == 'OpenLayers.Layer.TMS') {
                tile = {
                    url: layerUrl,//.replace('/tms/', '/wms/'),
                    parameters: {
                        service: 'WMS',
                        request: 'GetMap',
                        project: gcConfig.projectName,
                        map: gcConfig.mapsetName,
                        layers: [layer.layername.substr(0, layer.layername.indexOf('/'))],
                        version: '1.1.1',
                        format: 'image/png'
                    },
                    type: 'WMS',
                    opacity: layer.opacity ? (layer.opacity * 100) : 100
                };
            } else if(layer.CLASS_NAME == 'OpenLayers.Layer.WMS') {

                layer.params.project = gcConfig.projectName;
                layer.params.map  = gcConfig.mapsetName;
                if(typeof(layer.params["LAYERS"])!='object')
                    layer.params["LAYERS"] = layer.params["LAYERS"].split(",");
                tile = {
                    url: layerUrl,
                    type: 'WMS',
                    parameters: layer.params,
                    opacity: layer.opacity ? (layer.opacity * 100) : 100
                };
            } else if(layer.CLASS_NAME == 'OpenLayers.Layer.WMTS') {
                var params = {
                    LAYERS: [layer.name],
                    PROJECT: gcConfig.projectName,
                    MAP: gcConfig.mapsetName,
                    FORMAT: 'image/png',
                    SRS: layer.projection.projCode,
                    TRANSPARENT: true,
                    SERVICE: 'WMS',
                    VERSION: '1.1.1'
                };

                tile = {
                    //url: gcConfig.mapProxyBaseUrl+'/'+gcConfig.projectName+'/'+gcConfig.mapsetName+'/service?',
                    url:layerUrl,
                    type: 'WMS',
                    parameters: params,
                    opacity: layer.opacity ? (layer.opacity * 100) : 100
                };
            } else if(layer.CLASS_NAME == 'OpenLayers.Layer.OSM' ||
                layer.CLASS_NAME == 'OpenLayers.Layer.Google') {
                var params = {
                    LAYERS: [layer.name],
                    PROJECT: gcConfig.projectName,
                    MAP: gcConfig.mapsetName,
                    FORMAT: 'image/png',
                    SRS: "EPSG:3857",
                    TRANSPARENT: true,
                    SERVICE: 'WMS',
                    VERSION: '1.1.1'
                };
                tile = {
                    url:layerUrl,
                    type: 'WMS',
                    externalProvider: layer.CLASS_NAME.replace('OpenLayers.Layer.', ''),
                    parameters: params,
                    name: layer.name,
                    project: gcConfig.projectName,
                    map: gcConfig.mapsetName,
                };
                if (layer.type != null) {
                    tile.externalType = layer.type;
                }
            } else {
                console.log(layer.name+' '+layer.CLASS_NAME+' non riconosciuto per stampa');
            }
            if(tile) {
                if(layer.options.theme_id) {
                    tile.options = {
                        theme_id: layer.options.theme_id,
                        theme_title: layer.options.theme_title || ''
                    };
                }
                tiles.push(tile);
            }
        });

        //tiles.reverse();
        return tiles;
    },

    onBoxModify: function(e){

        //var bounds = e.feature.geometry.getBounds();
        //(misure di pagina in cm e sistema di riferimentoq in metri .. da generalizzare);
        //this.boxScale = this.roundScale(Math.abs(bounds.right-bounds.left)/this.pageW*100);
        if(this.maxScale && this.boxScale > this.maxScale) {
            this.boxScale = this.maxScale;
            this.updatePrintBox();
        }
        else {
            this.events.triggerEvent("updateboxInfo");
        }
    },


    activate: function() {
        var activated = OpenLayers.Control.prototype.activate.call(this);
        if(activated) {
            //.................

        }
    },

    updateMode: function(){
        this.modifyControl.mode = 0;
        if (this.allowDrag) this.modifyControl.mode |= OpenLayers.Control.ModifyFeature.DRAG;
        if (this.allowResize) this.modifyControl.mode |= OpenLayers.Control.ModifyFeature.RESIZE;
        if (this.allowRotation) this.modifyControl.mode |= OpenLayers.Control.ModifyFeature.ROTATE;
    },

    drawPrintBox: function() {

        var self = this;

        var pageSize=this.pages[this.pageLayout][this.pageFormat];
        var pageW = parseFloat(pageSize.w);
        var pageH = parseFloat(pageSize.h);
        this.pageW = pageW;
        this.pageH = pageH;

        //calcolo l'area libera per il box di stampa
        //(misure di pagina in cm e sistema di riferimentoq in metri .. da generalizzare);
        var boxW = this.map.size.w - this.offsetLeft - this.offsetRight - 2*this.margin;
        var boxH = this.map.size.h - this.offsetTop - this.offsetBottom - 2*this.margin;


        //normalizzo rispetto al rapporto dimensionale della stampa
        if(pageW/pageH > boxW/boxH)
            boxH = boxW*pageH/pageW;
        else
            boxW = boxH*pageW/pageH;


        var leftPix = parseInt((this.map.size.w - boxW)/2);
        var topPix = parseInt((this.map.size.h - boxH)/2);

        var lb = this.map.getLonLatFromPixel(new OpenLayers.Pixel(leftPix, topPix + boxH));
        var rt = this.map.getLonLatFromPixel(new OpenLayers.Pixel(leftPix + boxW, topPix));


        //vedo che scala è uscita
        //occhio all'unità di misura meglio portare tutto in pollici??
        //comunque per ora va tutto im metri
        var bounds = new OpenLayers.Bounds(lb.lon, lb.lat, rt.lon, rt.lat);

        var boundsScale;
        if (this.map.displayProjection && this.map.displayProjection != this.map.projection) {
            var projCOK = new OpenLayers.Projection(this.map.displayProjection);
            bounds.transform(this.map.getProjectionObject(), projCOK);
            boundsScale = this.roundScale(Math.abs(bounds.right - bounds.left)/pageW*100);
            var center = bounds.getCenterLonLat();
            bounds = new OpenLayers.Bounds(center.lon - pageW*boundsScale/200, center.lat - pageH*boundsScale/200, center.lon + pageW*boundsScale/200,  center.lat + pageH*boundsScale/200);
            bounds.transform(projCOK, this.map.getProjectionObject());
        }
        else {
            boundsScale = this.roundScale(Math.abs(lb.lon-rt.lon)/pageW*100);
        }

        //Se ho impostato la scala prima della chiamata scalo il box
        if(this.boxScale && this.maxScale){
            this.boxScale = Math.min(this.boxScale, this.maxScale);
        }
        else if(this.maxScale && this.maxScale < boundsScale){
            this.boxScale = this.maxScale;
        }

        if(this.boxScale){
            bounds = bounds.scale(this.boxScale/boundsScale);
        }
        else{
            this.boxScale = boundsScale;
        }

        this.geometryBox = bounds.toGeometry();
        this.originalBounds = bounds.clone();
        this.printBox = new OpenLayers.Feature.Vector(bounds.toGeometry());
        this.layerbox.addFeatures(this.printBox);
        if(this.allowDrag || this.allowResize || this.allowRotate){
            this.updateMode();
            this.modifyControl.pageRotation = 0;

            this.origLayerIndex = this.map.getLayerIndex(this.layerbox);
            var maxIndex = this.map.getLayerIndex(this.map.layers[this.map.layers.length -1]);
            if(this.origLayerIndex < maxIndex) this.map.raiseLayer(this.layerbox, (maxIndex - this.origLayerIndex));
            this.map.resetLayersZIndex();
            this.modifyControl.activate();
        }

        var map = this.map;
        map.events.register("moveend", map, function(){
            if(self.autoCenter) self.movePrintBox(map.getCenter());
        });



    },

    updatePrintBox: function(){

        //se cambio le dimensioni voglio comunque mantenere la scala di stampa!!!
        //non ruoto semplicemente il box perchè le dimensioni potrebbero essere diverse per il template di stampa

        var pageSize=this.pages[this.pageLayout][this.pageFormat];
        var pageW = parseFloat(pageSize.w);
        var pageH = parseFloat(pageSize.h);
        this.pageW = pageW;
        this.pageH = pageH;

        var boxW = pageW*this.boxScale/100;
        var boxH = pageH*this.boxScale/100;

        var bounds = this.printBox.geometry.getBounds();
        var center = bounds.getCenterLonLat();
        var newBounds;
        if (this.map.displayProjection && this.map.displayProjection != this.map.projection) {
            var projCOK = new OpenLayers.Projection(this.map.displayProjection);
            center.transform(this.map.getProjectionObject(), projCOK);
            newBounds = new OpenLayers.Bounds(center.lon - boxW/2, center.lat - boxH/2, center.lon + boxW/2,  center.lat + boxH/2);
            newBounds.transform(projCOK, this.map.getProjectionObject());
        }
        else {
            newBounds = new OpenLayers.Bounds(center.lon - boxW/2, center.lat - boxH/2, center.lon + boxW/2,  center.lat + boxH/2);
        }

        //????????????????????????????????????????? non aggiorna
        //BOH NON RIESCO A MODIFICARE LA FEATURE. QUINDI LA TOLGO E LA RIAGGIUNGO POI VEDIAMO
        if (this.modifyControl)
            if(this.modifyControl.feature)
                this.modifyControl.unselectFeature(this.printBox);
        this.printBox.destroy();
        this.printBox = new OpenLayers.Feature.Vector(newBounds.toGeometry());
        this.layerbox.addFeatures(this.printBox);
        this.events.triggerEvent("updateboxInfo");




    },

    movePrintBox: function(position){
        //if(!this.editMode) return;
        if(this.modifyControl && this.modifyControl.feature) this.modifyControl.unselectFeature(this.printBox);
        this.printBox.move(position);
        this.events.triggerEvent("updateboxInfo");

    },

    removePrintBox: function(){
        if (this.modifyControl) {
            if(this.modifyControl.feature)
                this.modifyControl.unselectFeature(this.printBox);
            this.modifyControl.deactivate();
            this.map.setLayerIndex(this.layerbox, this.origLayerIndex);
            this.map.resetLayersZIndex();
        }
        if (this.printBox)
            this.printBox.destroy();
    },

    getBounds: function(){
        return this.printBox.geometry.getBounds();

    },

    roundScale: function(scale){
        // if(scale > 1000000)
        //     scale = Math.ceil(scale/1000000) * 1000000;
        // else if(scale > 10000)
        //     scale = Math.ceil(scale/10000) * 10000;
        // else if(scale > 1000)
        //     scale = Math.ceil(scale/1000) * 1000;
        // else if(scale > 100)

        scale = Math.ceil(scale/100) * 100;
        return scale;
    }




});
