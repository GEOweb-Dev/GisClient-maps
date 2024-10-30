/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
 OpenLayers.Control.GeoNoteModifyFeature = OpenLayers.Class(OpenLayers.Control.ModifyFeature, {
     rotateHandleStyle: null,

     initialize: function(layer, options) {
         OpenLayers.Control.ModifyFeature.prototype.initialize.apply(this, arguments);
         var init_style = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style.select);
         this.rotateHandleStyle = OpenLayers.Util.extend(init_style, {
            fillColor: '#ee9900',
            strokeColor: '#ee9900',
            graphicName: 'circle',
         });
     },

     resetVertices: function() {
         if(this.feature && this.feature.geometry.CLASS_NAME == "OpenLayers.Geometry.LineString") {
             if((this.mode && (this.mode == OpenLayers.Control.ModifyFeature.RESHAPE || this.mode == OpenLayers.Control.ModifyFeature.RESIZE || this.mode == OpenLayers.Control.ModifyFeature.DRAG))) {
                 if (this.feature.attributes.quote_id) {
                     alert ('Operazione non valida su oggetti di tipo quota');
                     this.unselectFeature(this.feature);
                     this.deactivate();
                     this.map.currentControl=this.map.defaultControl;
                     return;
                 }
            }
         }
         OpenLayers.Control.ModifyFeature.prototype.resetVertices.apply(this, arguments);
         if(this.feature && this.feature.geometry.CLASS_NAME == "OpenLayers.Geometry.Point") {
             if((this.mode & (OpenLayers.Control.ModifyFeature.ROTATE))) {
                 if (this.feature.attributes.attach || this.feature.attributes.label) {
                     this.collectRadiusHandle();
                 }
            }
         }
     },

     unselectFeature: function(feature) {
         OpenLayers.Control.ModifyFeature.prototype.unselectFeature.apply(this, arguments);
         if (feature.attributes.quote_id) {
            var quoteArr = new Array();
            var ptArr = feature.geometry.getVertices();
            var pointAngle = feature.attributes.angle + 270;
            if (pointAngle > 360) pointAngle -= 360;
            quoteArr.push(new OpenLayers.Feature.Vector(ptArr[0],{label:'',quote_id:feature.attributes.quote_id,node:0,angle:pointAngle,color:feature.attributes.color,symbol:'triangle',radius:4,attach:''}));
            pointAngle += 180;
            if (pointAngle > 360) pointAngle -= 360;
            quoteArr.push(new OpenLayers.Feature.Vector(ptArr[1],{label:'',quote_id:feature.attributes.quote_id,node:1,angle:pointAngle,color:feature.attributes.color,symbol:'triangle',radius:4,attach:''}));
            this.layer.addFeatures(quoteArr);
         }

     },

     collectRadiusHandle: function() {
         var geometry = this.feature.geometry;
         var bounds = geometry.getBounds();
         var center = bounds.getCenterLonLat();
         var originGeometry = new OpenLayers.Geometry.Point(
             center.lon, center.lat
         );
         if (this.feature.geometry.CLASS_NAME == "OpenLayers.Geometry.Point") {
             var center_px = this.map.getPixelFromLonLat(center);

             var pixel_dis_x = 15;
             var pixel_dis_y = 15; // you can change this two values to get best radius geometry position.

             var radius_px = center_px.add(pixel_dis_x, pixel_dis_y);
             var radius_lonlat = this.map.getLonLatFromPixel(radius_px);

             var radiusGeometry = new OpenLayers.Geometry.Point(
                 radius_lonlat.lon, radius_lonlat.lat
             );
         }
         else {
              var radiusGeometry = new OpenLayers.Geometry.Point(
             bounds.right, bounds.bottom
         );
         }

         var radius = new OpenLayers.Feature.Vector(radiusGeometry, null, this.rotateHandleStyle);

         //OpenLayers.Util.extend(radius.attributes, this.feature.attributes);

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
                 if (self.feature.geometry.CLASS_NAME == "OpenLayers.Geometry.Point") {
                     var old_angle = self.feature.attributes.angle;
                     var new_angle = old_angle - angle;
                     self.feature.attributes.angle = new_angle;
                     if (self.feature.attributes.labelxoff || self.feature.attributes.labelyoff) {
                         var res = self.map.getResolution();
                         var xdist = self.feature.attributes.labelxoff*res;
                         var ydist = self.feature.attributes.labelyoff*res;
                         var offPoint = new OpenLayers.Geometry.Point(originGeometry.x+xdist,originGeometry.y+ydist);
                         offPoint.rotate(angle, originGeometry);
                         self.feature.attributes.labelxoff = (offPoint.x - originGeometry.x)/res;
                         self.feature.attributes.labelyoff = (offPoint.y - originGeometry.y)/res;
                     }
                     // redraw the feature
                     self.layer.drawFeature(self.feature);
                 }
                 else {
                     geometry.rotate(angle, originGeometry);
                     self.pageRotation+= angle;
                     if (self.pageRotation > 360) self.pageRotation-=360;
                     // **** Quota
                     if (self.feature.attributes.centroid && self.feature.geometry.CLASS_NAME == "OpenLayers.Geometry.LineString") {
                         var old_angle = self.feature.attributes.angle;
                         var new_angle = old_angle - angle;
                         self.feature.attributes.angle = new_angle;
                         var ptArr = geometry.getVertices();
                         var dx = ptArr[1].x-ptArr[0].x;
                         var dy = ptArr[1].y-ptArr[0].y;
                         var angle1 = Math.atan2(dy,dx);
                         var dist = 12 * self.map.getResolution();
                         self.feature.attributes.centroid = new OpenLayers.Geometry.Point(center.lon - Math.sin(angle1) * dist,Math.cos(angle1) * dist + center.lat);

                     }
                 }
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
                 if (self.feature.attributes.label && self.feature.attributes.unit && self.feature.geometry.CLASS_NAME == "OpenLayers.Geometry.LineString") {
                     var newMeasure = geometry.getGeodesicLength(self.map.projection);
                     if (self.feature.attributes.unit == 'km') {
                         newMeasure = newMeasure/1000;
                     }
                     self.feature.attributes.label = sprintf('%01.3f', newMeasure) + ' ' + self.feature.attributes.unit;
                 }
             }
         };
         radius._sketch = true;
         this.radiusHandle = radius;
         this.layer.addFeatures([this.radiusHandle], {silent: true});
     },

     collectDragHandle: function() {
        var geometry = this.feature.geometry;
        var center = geometry.getBounds().getCenterLonLat();
        var originGeometry = new OpenLayers.Geometry.Point(
            center.lon, center.lat
        );
        var origin = new OpenLayers.Feature.Vector(originGeometry);
        var self = this;
        originGeometry.move = function(x, y) {
            OpenLayers.Geometry.Point.prototype.move.call(this, x, y);
            geometry.move(x, y);
            if (self.feature.attributes.centroid && self.feature.geometry.CLASS_NAME == "OpenLayers.Geometry.LineString") {
                var ptArr = geometry.getVertices();
                var newCenter = geometry.getBounds().getCenterLonLat();
                var dx = ptArr[1].x-ptArr[0].x;
                var dy = ptArr[1].y-ptArr[0].y;
                var angle1 = Math.atan2(dy,dx);
                var dist = 12 * self.map.getResolution();
                self.feature.attributes.centroid = new OpenLayers.Geometry.Point(newCenter.lon - Math.sin(angle1) * dist,Math.cos(angle1) * dist + newCenter.lat);
            }
        };
        origin._sketch = true;
        this.dragHandle = origin;
        this.dragHandle.renderIntent = this.vertexRenderIntent;
        this.layer.addFeatures([this.dragHandle], {silent: true});
    },

     CLASS_NAME: "OpenLayers.Control.GeoNoteModifyFeature"
 });




OpenLayers.GisClient.geoNoteToolbar = OpenLayers.Class(OpenLayers.Control.Panel,{
    // **** baseUrl - Gisclient service URL
    baseUrl : '/gisclient3/',
    config: {},
    redlineLayer : null,
    symbolFontFiles: [],
    symbolArr: [],
    snapLayer : null,
    snapMapQuery: null,
    snapCtrl: null,
    snapMaxScale: 3000,
    div: null,
    mainPanel: null,
    panelList: {},
    controlList: {},
    featureAttr: {},
    redlineColorPalette: ['#FF00FF'],
    redlineColor: '#FF00FF',
    redlineColorM: '#FF00FF',
    defaultStrokeWidth: 1,
    defaultPointRadius: 1,

    noteID: null,
    noteList: {},
    noteTitle: 'Nuova nota',
    noteDefaultStatus: "Nuova",
    noteDefaultTitle: 'Nuova nota',
    savedState: false,
    loading: false,
    userSettings: {},

    initialize: function(options) {
        OpenLayers.Control.Panel.prototype.initialize.apply(this, [options]);

        // **** Set default panels
        OpenLayers.Util.extend(this.panelList, {
            geonote_color: {class: ['geonote_panel_cls_draw','geonote_panel_cls_edit','geonote_colorpicker_container'],
            title: '<span class="geonote_colorpicker_header_badge glyphicon-white glyphicon-stop" style="margin-right: 10px; color: '+this.redlineColor+';"></span>Colore',
            foldable: true,
            content: '<div class="geonote_panel_elem_options"><div><span class="geonote_options_header">Scelta colori</span><span class="geonote_options_content">\
                <a id="geonote_color_palette_switch" class="olButton olControlItemActive">Predefiniti</a>\
                <a id="geonote_color_colorpicker_switch" class="olButton olControlItemInctive">Tutti</a></span></div></div>\
                <div id="geonote_color_palette" class="olToolbarControl"></div><div id="geonote_colorpicker" class="olToolbarControl cp-default" style="display:none;"></div>\
                <div><span class="geonote_colorpicker_display">&nbsp</span></div></div>'
            },
            create_point: {class: 'geonote_panel_cls_draw', title: 'Oggetti Puntuali', foldable: true, content: null},
            create_line: {class: 'geonote_panel_cls_draw', title: 'Oggetti Lineari', foldable: true, content: null},
            create_polygon: {class: 'geonote_panel_cls_draw', title: 'Oggetti Poligonali', foldable: true, content: null},
            create_quote: {class: 'geonote_panel_cls_draw', title: 'Quote', foldable: true, content: null},
            geom_edit: {class: 'geonote_panel_cls_edit', title: 'Modifica Oggetti', foldable: true, content: null},
            note_manage: {class: 'geonote_panel_cls_manage', title: null, foldable: false, content: null},
            note_snap: {class: 'geonote_panel_cls_manage', title: 'Snapping', foldable: true, content: null},
        });

        // **** Create toolbar DOM Objects
        this.mainPanel = document.createElement('div');
        this.mainPanel.setAttribute('id', 'geonote_panel_main');
        var divNoteTitle = document.createElement('div');
        divNoteTitle.setAttribute('id', 'geonote_panel_note_title');
        this.mainPanel.appendChild(divNoteTitle);
        var txtNoteHeader = document.createElement('span');
        txtNoteHeader.setAttribute('id', 'geonote_note_header');
        divNoteTitle.appendChild(txtNoteHeader);
        var txtNoteTitle = document.createElement('span');
        txtNoteTitle.setAttribute('id', 'geonote_note_title');
        divNoteTitle.appendChild(txtNoteTitle);
        var divNoteMapset = document.createElement('div');
        divNoteMapset.setAttribute('id', 'geonote_panel_note_mapset');
        this.mainPanel.appendChild(divNoteMapset);
        var txtNoteHeaderM = document.createElement('span');
        txtNoteHeaderM.setAttribute('id', 'geonote_note_header_mapset');
        divNoteMapset.appendChild(txtNoteHeaderM);
        var txtNoteTitleM = document.createElement('span');
        txtNoteTitleM.setAttribute('id', 'geonote_note_mapset');
        divNoteMapset.appendChild(txtNoteTitleM);
        var divNoteStatus = document.createElement('div');
        divNoteStatus.setAttribute('id', 'geonote_panel_note_status');
        this.mainPanel.appendChild(divNoteStatus);
        var txtNoteHeaderS = document.createElement('span');
        txtNoteHeaderS.setAttribute('id', 'geonote_note_header_status');
        divNoteStatus.appendChild(txtNoteHeaderS);
        var txtNoteTitleS = document.createElement('span');
        txtNoteTitleS.setAttribute('id', 'geonote_note_status');
        divNoteStatus.appendChild(txtNoteTitleS);

        var panelIDs = Object.keys(this.panelList);
        for (var k = 0; k < panelIDs.length; k++) {
            var panelID = panelIDs[k];
            this.createPanelElement(panelID, this.panelList[panelID].class, this.panelList[panelID].title, this.panelList[panelID].foldable, this.panelList[panelID].content);
        };

        this.serviceURL = this.baseUrl + 'services/plugins/geonote/redline.php';

        var redlineStyleDefault = new OpenLayers.Style({
            pointRadius: '${radius}',
            fillOpacity: 0.7,
            fontSize: "${fontsize}",
            fontFamily: "Courier New, monospace",
            fontWeight: "bold",
            fontColor: '${color}',
            labelAlign: "cm",
            labelXOffset: '${labelxoff}',
            labelYOffset: '${labelyoff}',
            labelSelect: true,
            fillColor: '${color}',
            strokeColor: '${color}',
            strokeWidth: '${strokewidth}',
            strokeDashstyle: "${dashstyle}",
            label: '${label}',
            externalGraphic: '${attach}',
            graphicName: '${symbol}',
            graphicWidth: '${attachsize}',
            graphicHeight: '${attachsize}',
            rotation: '${angle}',
            angle: '${angle}'
            }
        );

        var redlineStyleTemporary = new OpenLayers.Style({
            pointRadius: 5,
            fillOpacity: 0.4,
            fontSize: "12px",
            fontFamily: "Courier New, monospace",
            fontWeight: "bold",
            labelAlign: "cm",
            labelXOffset: 0,
            labelYOffset: 10,
            fillColor: '#ee9900',
            strokeColor: '#ee9900',
            label: '',
            externalGraphic: '',
            graphicName: 'circle'
            }
        );

        var redlineStyleSelect = new OpenLayers.Style({
            pointRadius: 5,
            fillOpacity: 0.4,
            fontSize: "12px",
            fontFamily: "Courier New, monospace",
            fontWeight: "bold",
            labelAlign: "cm",
            labelXOffset: 0,
            labelYOffset: 10,
            fillColor: '#ee9900',
            strokeColor: '#ee9900',
            }
        );

        var redlineStyleMap = new OpenLayers.StyleMap({
            'default': redlineStyleDefault,
            'temporary': redlineStyleTemporary,
            'select': redlineStyleSelect
	});

        var saveStrategy = new OpenLayers.Strategy.Save(
            {
                eventListeners: {
                    start: this.saveSuccess,
                    success: this.saveSuccess,
                    fail: this.saveFail,
                    scope:this
                },
                pippo:'pippo'
            }
        );

        var loadStrategy = new OpenLayers.Strategy.Fixed(
            {
                loadend:{
                        callback: this.loadSuccess,
                        scope:this
                },
                update:{
                        callback:function(response){console.log('UPDATE')},
                        scope:this
                },
                pippo:'pippo'
            }
        );

        saveStrategy.events.register('fail', this, this.saveFail);

        this.redlineLayer = new OpenLayers.Layer.Vector('Redline', {
            displayInLayerSwitcher:false,
            styleMap: redlineStyleMap,
            strategies: [
                saveStrategy, loadStrategy
            ]
        });

        this.snapLayer = new OpenLayers.Layer.Vector('GeoNoteSnap', {
            displayInLayerSwitcher:false
        });
        this.snapCtrl = new OpenLayers.Control.Snapping({
            layer: this.redlineLayer,
            targets: [this.snapLayer,this.redlineLayer],
            greedy: true
        });

        this.snapMapQuery = new OpenLayers.Control.QueryMap(
            OpenLayers.Handler.Polygon,
            {
                ctrl: this,
                gc_id: 'control-geonote-snap-query',
                baseUrl: GisClientMap.baseUrl,
                maxFeatures:10000,
                maxVectorFeatures: 10000,
                wfsCache: new Array(),
                deactivateAfterSelect: false,
                vectorFeaturesOverLimit: new Array(),
                resultLayer:this.snapLayer,
                busy: false,
                eventListeners: {
                    'activate': function(){
                    },
                    'endQueryMap': function(event) {
                        var loadingControl = GisClientMap.map.getControlsByClass('OpenLayers.Control.LoadingPanel')[0];
                        loadingControl.minimizeControl();
                        this.busy = false;
                        if (this.snapExtent != this.map.getExtent().toString()) {
                            this.ctrl.getSnapFeatures();
                        }
                    }
                }
            }
        );

        var controls = [
            new OpenLayers.Control(
                {
                    ctrl: this,
                    type: OpenLayers.Control.TYPE_BUTTON ,
                    iconclass:"glyphicon-white glyphicon-pencil",
                    panelclass:"geonote_panel_cls_draw",
                    text:"Disegna",
                    title:"Disegna oggetto",
                    trigger: this.managePanels
                }
            ),
            new OpenLayers.Control(
                {
                    ctrl: this,
                    type: OpenLayers.Control.TYPE_BUTTON ,
                    iconclass:"glyphicon-white glyphicon-edit",
                    panelclass:"geonote_panel_cls_edit",
                    text:"Modifica",
                    title:"Modifica Oggetto",
                    trigger: this.managePanels
                }
            ),
            new OpenLayers.Control(
                {
                    ctrl: this,
                    type: OpenLayers.Control.TYPE_BUTTON ,
                    iconclass:"glyphicon-white glyphicon-wrench",
                    panelclass:"geonote_panel_cls_manage",
                    text:"Strumenti",
                    title:"Strumenti Nota",
                    trigger: this.managePanels
                }
            )
        ];

        this.addControls(controls);

        OpenLayers.Util.extend(this.controlList, {
            create_point: [
                new OpenLayers.Control.DrawFeature(
                    this.redlineLayer,
                    OpenLayers.Handler.Point,
                    {
                        ctrl: this,
                        iconclass:"glyphicon-white glyphicon-asterisk",
                        text:"Punto",
                        title:"Inserisci punto",
                        eventListeners: {
                            'activate': function(){
                                this.map.currentControl.deactivate();
                                this.map.currentControl=this;
                                var toolsDiv = document.getElementById('geonote_panel_elem_options_create_point');
                                var htmlText = '<div><span class="geonote_options_header">Dimensione punto</span><span class="geonote_options_content">';
                                htmlText += '<select class="form-control" id="geonote_radius_text" data-geonote-attr="radius">'
                                for (var i=1; i<=20;i++) {
                                    if (i == this.ctrl.defaultPointRadius) {
                                        htmlText += '<option value="'+i+'" selected>'+i+'</option>';
                                    }
                                    else {
                                        htmlText += '<option value="'+i+'">'+i+'</option>';
                                    }
                                }
                                htmlText += '</select>';
                                htmlText +='</span></div>';
                                toolsDiv.innerHTML = htmlText;
                            },
                            'deactivate': function() {
                                var toolsDiv = document.getElementById('geonote_panel_elem_options_create_point');
                                toolsDiv.innerHTML = '';
                            }
                        }
                    }
                ),
                new OpenLayers.Control.DrawFeature(
                    this.redlineLayer,
                    OpenLayers.Handler.Point,
                    {
                        ctrl: this,
                        iconclass:"glyphicon-white glyphicon-tag",
                        text:"Etichetta",
                        title:"Inserisci etichetta",
                        eventListeners: {
                            'activate': function(){
                                this.map.currentControl.deactivate();
                                this.map.currentControl=this;
                                var toolsDiv = document.getElementById('geonote_panel_elem_options_create_point');
                                toolsDiv.innerHTML = '<div><span class="geonote_options_header">Disegna etichetta</span><span class="geonote_options_content">\
                                <a id="geonote_label_orientation_disable" class="olButton olControlItemInactive">Semplice</a>\
                                <a id="geonote_label_orientation_enable" class="olButton olControlItemActive">Orientata</a></span>';
                                toolsDiv.innerHTML += '<div><span class="geonote_options_header">Testo Etichetta</span>\
                                <span class="geonote_options_content"><textarea name="text" class="form-control" id="geonote_label_text" data-geonote-attr="label"></textarea></span></div>';
                                var htmlText = '<div><span class="geonote_options_header">Dimensione testo</span><span class="geonote_options_content">';
                                htmlText += '<select class="form-control" id="geonote_fontsize_text" data-geonote-attr="fontsize">';
                                for (var i=6; i<=30;i+=2) {
                                    if (i==12) {
                                        htmlText += '<option selected value="'+i+'px">'+i+'</option>';
                                    }
                                    else {
                                        htmlText += '<option value="'+i+'px">'+i+'</option>';
                                    }
                                }
                                htmlText += '</select>';
                                htmlText +='</span></div>';
                                htmlText += '<input type="hidden" value="1" class="form-control"  id="geonote_orientation_text" data-geonote-attr="orientation">';
                                htmlText += '<div><span class="geonote_options_header">Dimensione punto</span><span class="geonote_options_content">';
                                htmlText += '<select class="form-control" id="geonote_radius_text" data-geonote-attr="radius">';
                                htmlText += '<option value="0">Nascosto</option>';
                                for (var i=1; i<=20;i++) {
                                    htmlText += '<option value="'+i+'">'+i+'</option>';
                                }
                                htmlText += '</select>';
                                htmlText +='</span></div>';
                                toolsDiv.innerHTML += htmlText;

                                var orEnBtn = document.getElementById('geonote_label_orientation_enable');
                                orEnBtn.addEventListener("click", function(evt) {
                                    evt.currentTarget.classList.remove('olControlItemInactive');
                                    evt.currentTarget.classList.add('olControlItemActive');
                                    orBtn = document.getElementById('geonote_label_orientation_disable');
                                    orBtn.classList.remove('olControlItemActive');
                                    orBtn.classList.add('olControlItemInactive');
                                    document.getElementById('geonote_orientation_text').setAttribute('value',"1");
                                });
                                var orDisBtn = document.getElementById('geonote_label_orientation_disable');
                                orDisBtn.addEventListener("click", function(evt) {
                                    evt.currentTarget.classList.remove('olControlItemInactive');
                                    evt.currentTarget.classList.add('olControlItemActive');
                                    orBtn = document.getElementById('geonote_label_orientation_enable');
                                    orBtn.classList.remove('olControlItemActive');
                                    orBtn.classList.add('olControlItemInactive');
                                    document.getElementById('geonote_orientation_text').setAttribute('value',"");
                                    var redlineLayer = GisClientMap.map.getLayersByName('Redline')[0];
                                    if (redlineLayer.features.length > 0) {
                                        redlineLayer.features[redlineLayer.features.length-1].style = null;
                                        redlineLayer.redraw();
                                    }
                                });
                            },
                            'deactivate': function() {
                                var toolsDiv = document.getElementById('geonote_panel_elem_options_create_point');
                                toolsDiv.innerHTML = '';
                                if (this.ctrl.redlineLayer.features.length > 0) {
                                    this.ctrl.redlineLayer.features[this.ctrl.redlineLayer.features.length-1].style = null;
                                    this.ctrl.redlineLayer.redraw();
                                }
                            }
                        }
                    }
                ),
                new OpenLayers.Control.DrawFeature(
                    this.redlineLayer,
                    OpenLayers.Handler.Point,
                    {
                        ctrl: this,
                        iconclass:"glyphicon-white glyphicon-certificate",
                        text:"Simbolo",
                        title:"Inserisci simbolo",
                        eventListeners: {
                            'activate': function(){
                                this.map.currentControl.deactivate();
                                this.map.currentControl=this;
                                var baseUrl = this.ctrl.baseUrl;
                                var toolsDiv = document.getElementById('geonote_panel_elem_options_create_point');
                                var symbolArr = this.ctrl.symbolArr;
                                var symbolFavArr = this.ctrl.config.symbols[this.map.config.mapsetName];
                                var ctrl = this.ctrl;
                                toolsDiv.innerHTML = '<div><span class="geonote_options_header">Disegna simbolo</span><span class="geonote_options_content">\
                                <a id="geonote_label_orientation_disable" class="olButton olControlItemInactive">Semplice</a>\
                                <a id="geonote_label_orientation_enable" class="olButton olControlItemActive">Orientato</a></span>';
                                toolsDiv.innerHTML += '<div><span class="geonote_options_header">Visualizza simboli</span><span class="geonote_options_content">\
                                <a id="geonote_symbol_show_all" class="olButton">Tutti</a>\
                                <a id="geonote_symbol_show_fav" class="olButton">Preferiti</a></span>';
                                toolsDiv.innerHTML += '<input type="hidden" value="" class="form-control" id="geonote_symbol_text" data-geonote-symbol="" data-geonote-attr="attach">';
                                toolsDiv.innerHTML += '<input type="hidden" value="1" class="form-control"  id="geonote_orientation_text" data-geonote-attr="orientation">';
                                toolsDiv.innerHTML += '<div class="geonote_symbol_list" id="geonote_symbol_list_all"></div>';
                                toolsDiv.innerHTML += '<div class="geonote_symbol_list" id="geonote_symbol_list_fav"></div>';
                                var symbolListCtrl = document.getElementById("geonote_symbol_list_all");
                                for (var i=0; i<this.ctrl.symbolArr.length; i++) {
                                    symbolListCtrl.innerHTML += '<div><span class="geonote_options_header geonote_symbol_label">' + symbolArr[i] +
                                    '</span><span class="geonote_options_content"><a id="geonote_symbol_btn_' + symbolArr[i] + '" data-geonote-symbol="' + symbolArr[i] + '" class="olButton olControlItemInactive"><img src="' +
                                    baseUrl + '/admin/getImage.php?table=symbol&id=' + symbolArr[i] + '"></a></span><span class="geonote_options_content"><a id="geonote_symbol_fav_' + symbolArr[i] + '" data-geonote-symbol="' + symbolArr[i] + '" class="olButton glyphicon-white glyphicon-star-empty"></a></span></div>';
                                }

                                this.ctrl.setFavoriteSymbol();
                                var symbolHCtrl = document.getElementById("geonote_symbol_text");

                                var lstFullBtn = document.getElementById('geonote_symbol_show_all');
                                lstFullBtn.addEventListener("click", function(evt) {
                                    evt.currentTarget.classList.remove('olControlItemInactive');
                                    evt.currentTarget.classList.add('olControlItemActive');
                                    orBtn = document.getElementById('geonote_symbol_show_fav');
                                    orBtn.classList.remove('olControlItemActive');
                                    orBtn.classList.add('olControlItemInactive');
                                    document.getElementById("geonote_symbol_list_all").style.display = 'flow-root';
                                    document.getElementById("geonote_symbol_list_fav").style.display = 'none';
                                });
                                var lstFavBtn = document.getElementById('geonote_symbol_show_fav');
                                lstFavBtn.addEventListener("click", function(evt) {
                                    evt.currentTarget.classList.remove('olControlItemInactive');
                                    evt.currentTarget.classList.add('olControlItemActive');
                                    orBtn = document.getElementById('geonote_symbol_show_all');
                                    orBtn.classList.remove('olControlItemActive');
                                    orBtn.classList.add('olControlItemInactive');
                                    document.getElementById("geonote_symbol_list_all").style.display = 'none';
                                    document.getElementById("geonote_symbol_list_fav").style.display = 'flow-root';
                                });

                                if (symbolFavArr.length > 0) {
                                    lstFavBtn.classList.add('olControlItemActive');
                                    lstFullBtn.classList.add('olControlItemInactive');
                                    document.getElementById("geonote_symbol_list_fav").style.display = 'flow-root';
                                    symbolListCtrl.style.display = 'none';
                                    symbolHCtrl.setAttribute('value', this.ctrl.baseUrl + '/admin/getImage.php?table=symbol&id=' + symbolFavArr[0] + '&transparency=1');
                                    symbolHCtrl.setAttribute('data-geonote-symbol', symbolFavArr[0]);
                                    var ctrlSel = document.getElementById('geonote_symbol_btn_fav_' + symbolFavArr[0]);
                                    ctrlSel.classList.remove('olControlItemInactive');
                                    ctrlSel.classList.add('olControlItemActive');
                                }
                                else {
                                    lstFavBtn.classList.add('olControlItemInactive');
                                    lstFullBtn.classList.add('olControlItemActive');
                                    document.getElementById("geonote_symbol_list_fav").style.display = 'none';
                                    symbolListCtrl.style.display = 'flow-root';
                                    symbolHCtrl.setAttribute('value', this.ctrl.baseUrl + '/admin/getImage.php?table=symbol&id=' + symbolArr[0] + '&transparency=1');
                                    symbolHCtrl.setAttribute('data-geonote-symbol', symbolArr[0]);
                                    var ctrlSel = document.getElementById('geonote_symbol_btn_' + symbolArr[0]);
                                    ctrlSel.classList.remove('olControlItemInactive');
                                    ctrlSel.classList.add('olControlItemActive');
                                }

                                for (var i=0; i<symbolArr.length; i++) {
                                    var symbolBtn = document.getElementById('geonote_symbol_btn_'+symbolArr[i]);
                                    symbolBtn.addEventListener("click", function(evt) {
                                        var symbolHCtrl = document.getElementById("geonote_symbol_text");
                                        var symbolOld = symbolHCtrl.getAttribute('data-geonote-symbol');
                                        var symbolNew = evt.currentTarget.getAttribute('data-geonote-symbol');
                                        var ctrlOld = document.getElementById('geonote_symbol_btn_fav_' + symbolOld);
                                        if (ctrlOld) {
                                            ctrlOld.classList.remove('olControlItemActive');
                                            ctrlOld.classList.add('olControlItemInactive');
                                        }
                                        ctrlOld = document.getElementById('geonote_symbol_btn_' + symbolOld);
                                        ctrlOld.classList.remove('olControlItemActive');
                                        ctrlOld.classList.add('olControlItemInactive');
                                        symbolHCtrl.setAttribute('value', baseUrl + '/admin/getImage.php?table=symbol&id=' + symbolNew + '&transparency=1');
                                        symbolHCtrl.setAttribute('data-geonote-symbol', symbolNew);
                                        evt.currentTarget.classList.remove('olControlItemInactive');
                                        evt.currentTarget.classList.add('olControlItemActive');
                                    });
                                    var symbolFav = document.getElementById('geonote_symbol_fav_'+symbolArr[i]);
                                    symbolFav.addEventListener("click", function(evt) {
                                        var symbolNew = evt.currentTarget.getAttribute('data-geonote-symbol');
                                        var redlineCtrl = GisClientMap.map.getControlsBy('gc_id', 'control-redline')[0];
                                        redlineCtrl.setFavoriteSymbol(symbolNew);
                                    });
                                }
                                var orEnBtn = document.getElementById('geonote_label_orientation_enable');
                                orEnBtn.addEventListener("click", function(evt) {
                                    evt.currentTarget.classList.remove('olControlItemInactive');
                                    evt.currentTarget.classList.add('olControlItemActive');
                                    orBtn = document.getElementById('geonote_label_orientation_disable');
                                    orBtn.classList.remove('olControlItemActive');
                                    orBtn.classList.add('olControlItemInactive');
                                    document.getElementById('geonote_orientation_text').setAttribute('value',"1");
                                });
                                var orDisBtn = document.getElementById('geonote_label_orientation_disable');
                                orDisBtn.addEventListener("click", function(evt) {
                                    evt.currentTarget.classList.remove('olControlItemInactive');
                                    evt.currentTarget.classList.add('olControlItemActive');
                                    orBtn = document.getElementById('geonote_label_orientation_enable');
                                    orBtn.classList.remove('olControlItemActive');
                                    orBtn.classList.add('olControlItemInactive');
                                    document.getElementById('geonote_orientation_text').setAttribute('value',"");
                                    var redlineLayer = GisClientMap.map.getLayersByName('Redline')[0];
                                    if (redlineLayer.features.length > 0) {
                                        redlineLayer.features[redlineLayer.features.length-1].style = null;
                                        redlineLayer.redraw();
                                    }
                                });
                            },
                            'deactivate': function() {
                                var toolsDiv = document.getElementById('geonote_panel_elem_options_create_point');
                                toolsDiv.innerHTML = '';
                                toolsDiv.style.removeProperty('height');
                                toolsDiv.style.removeProperty('overflow');
                                if (this.ctrl.redlineLayer.features.length > 0) {
                                    this.ctrl.redlineLayer.features[this.ctrl.redlineLayer.features.length-1].style = null;
                                    this.ctrl.redlineLayer.redraw();
                                }
                            }
                        }
                    }
                ),
            ],
            create_line: [
                new OpenLayers.Control.DrawFeature(
                    this.redlineLayer,
                    OpenLayers.Handler.Path,
                    {
                        ctrl: this,
                        handlerOptions:{freehand:false},
                        iconclass:"glyphicon-white glyphicon-chevron-left",
                        text:"Spezzata",
                        title:"Inserisci linea spezzata",
                        eventListeners: {
                            'activate': function(){
                                this.map.currentControl.deactivate();
                                this.map.currentControl=this;
                                var toolsDiv = document.getElementById('geonote_panel_elem_options_create_line');
                                var htmlText = '<div><span class="geonote_options_header">Spessore linea</span><span class="geonote_options_content">';
                                htmlText += '<select class="form-control" id="geonote_strokewidth_text" data-geonote-attr="strokewidth">'
                                for (var i=1; i<=20;i++) {
                                    if (i == this.ctrl.defaultStrokeWidth) {
                                        htmlText += '<option value="'+i+'" selected>'+i+'</option>';
                                    }
                                    else {
                                        htmlText += '<option value="'+i+'">'+i+'</option>';
                                    }
                                }
                                htmlText += '</select>';
                                htmlText +='</span></div>';
                                htmlText += '<div><span class="geonote_options_header">Stile linea</span><span class="geonote_options_content">';
                                htmlText += '<select class="form-control" id="geonote_dashstyle_text" data-geonote-attr="dashstyle">';
                                htmlText += '<option selected value="solid">continua</option>';
                                htmlText += '<option value="dot">punti</option>';
                                htmlText += '<option value="dash">tratteggio</option>';
                                htmlText += '<option value="longdash">tratteggio lungo</option>';
                                htmlText += '<option value="dashdot">linea punto</option>';
                                htmlText += '<option value="longdashdot">linea lunga punto</option>';
                                htmlText += '</select>';
                                htmlText +='</span></div>';
                                toolsDiv.innerHTML = htmlText;

                            },
                            'deactivate': function() {
                                var toolsDiv = document.getElementById('geonote_panel_elem_options_create_line');
                                toolsDiv.innerHTML = '';
                            }
                        }
                    }
                ),
                new OpenLayers.Control.DrawFeature(
                    this.redlineLayer,
                    OpenLayers.Handler.Path,
                    {
                        ctrl: this,
                        handlerOptions:{freehand:true},
                        iconclass:"glyphicon-white glyphicon-pencil",
                        text:"Curva",
                        title:"Inserisci linea curva",
                        eventListeners: {
                            'activate': function(){
                                this.map.currentControl.deactivate();
                                this.map.currentControl=this;
                                var toolsDiv = document.getElementById('geonote_panel_elem_options_create_line');
                                var htmlText = '<div><span class="geonote_options_header">Spessore linea</span><span class="geonote_options_content">';
                                htmlText += '<select class="form-control" id="geonote_strokewidth_text" data-geonote-attr="strokewidth">'
                                for (var i=1; i<=20;i++) {
                                    if (i == this.ctrl.defaultStrokeWidth) {
                                        htmlText += '<option value="'+i+'" selected>'+i+'</option>';
                                    }
                                    else {
                                        htmlText += '<option value="'+i+'">'+i+'</option>';
                                    }
                                }
                                htmlText += '</select>';
                                htmlText +='</span></div>';
                                htmlText += '<div><span class="geonote_options_header">Stile linea</span><span class="geonote_options_content">';
                                htmlText += '<select class="form-control" id="geonote_dashstyle_text" data-geonote-attr="dashstyle">';
                                htmlText += '<option selected value="solid">continua</option>';
                                htmlText += '<option value="dot">punti</option>';
                                htmlText += '<option value="dash">tratteggio</option>';
                                htmlText += '<option value="longdash">tratteggio lungo</option>';
                                htmlText += '<option value="dashdot">linea punto</option>';
                                htmlText += '<option value="longdashdot">linea lunga punto</option>';
                                htmlText += '</select>';
                                htmlText +='</span></div>';
                                toolsDiv.innerHTML = htmlText;
                            },
                            'deactivate': function() {
                                var toolsDiv = document.getElementById('geonote_panel_elem_options_create_line');
                                toolsDiv.innerHTML = '';
                            }
                        }
                    }
                ),
            ],
            create_polygon: [
                new OpenLayers.Control.DrawFeature(
                    this.redlineLayer,
                    OpenLayers.Handler.Polygon,
                    {
                        iconclass:"glyphicon-white glyphicon-unchecked",
                        text:"Poligono",
                        title:"Inserisci poligono",
                        eventListeners: {'activate': function(){
                                this.map.currentControl.deactivate();
                                this.map.currentControl=this;
                            }
                        }
                    }
                ),
                new OpenLayers.Control.DrawFeature(
                    this.redlineLayer,
                    OpenLayers.Handler.RegularPolygon,
                    {
                        handlerOptions: {sides: 50},
                        iconclass:"glyphicon-white glyphicon-record",
                        text:"Cerchio",
                        title:"Inserisci cerchio",
                        eventListeners: {'activate': function(){
                                this.map.currentControl.deactivate();
                                this.map.currentControl=this;
                            }
                        }
                    }
                ),
                new OpenLayers.Control.DrawFeature(
                    this.redlineLayer,
                    OpenLayers.Handler.RegularPolygon,
                    {

                        handlerOptions: {sides: 3},
                        iconclass:"glyphicon-white glyphicon-record",
                        text:"Poligono Regolare",
                        title:"Inserisci Poligono Regolare",
                        eventListeners: {
                            'activate': function(){
                                var ctrl = this;
                                this.map.currentControl.deactivate();
                                this.map.currentControl=this;
                                var toolsDiv = document.getElementById('geonote_panel_elem_options_create_polygon');
                                var htmlText = '<div><span class="geonote_options_header">Numero lati</span><span class="geonote_options_content">';
                                htmlText += '<select class="form-control" id="geonote_polygon_sides_text">'
                                for (var i=3; i<=20;i++) {
                                    htmlText += '<option value="'+i+'">'+i+'</option>';
                                }
                                htmlText += '</select>';
                                htmlText +='</span></div>';
                                toolsDiv.innerHTML = htmlText;
                                var selTag = toolsDiv.getElementsByTagName('select').item(0);
                                selTag.addEventListener("change", function(evt) {
                                    ctrl.handler.sides = evt.currentTarget.value;
                                });
                            },
                            'deactivate': function() {
                                var toolsDiv = document.getElementById('geonote_panel_elem_options_create_polygon');
                                toolsDiv.innerHTML = '';
                            }
                        }
                    }
                ),
            ],
            create_quote: [
                new OpenLayers.Control.DynamicMeasure(OpenLayers.Handler.Path,{
                    ctrl: this,
                    iconclass:"glyphicon-white glyphicon-resize-horizontal",
                    text:"Quota allineata",
                    title:"Inserisci Quota allineata",
                    geodesic:true,
                    eventListeners: {
                        'activate': function() {
                            this.map.currentControl.deactivate();
                            this.map.currentControl=this;
                        },
                        'measure': function(obj) {
                            var totGeomPoints = this.handler.layer.features[0].geometry.getVertices();
                            var quoteArr = new Array();
                            for (var i=0; i<this.layerSegments.features.length; i++) {
                                var quoteObj = this.layerSegments.features[i];
                                var ptArr =  [totGeomPoints[quoteObj.attributes.from], totGeomPoints[quoteObj.attributes.from+1]];
                                var quoteGeom = new OpenLayers.Geometry.LineString(ptArr);
                                var quoteFeature = new OpenLayers.Feature.Vector(quoteGeom, {label: quoteObj.attributes.measure+' '+quoteObj.attributes.units,unit:quoteObj.attributes.units,quote_id:obj.geometry.id+'_'+i,angle:0,color:this.ctrl.redlineColor,symbol:'circle',strokewidth:'1'});
                                var bounds = quoteGeom.getBounds();
                                var center = bounds.getCenterLonLat();
                                var dx = ptArr[1].x-ptArr[0].x;
                                var dy = ptArr[1].y-ptArr[0].y;
                                var angle = Math.atan2(dx,dy);
                                var angle1 = Math.atan2(dy,dx);
                                var dist = 12 * this.map.getResolution();
                                quoteFeature.attributes.centroid = new OpenLayers.Geometry.Point(center.lon - Math.sin(angle1) * dist,Math.cos(angle1) * dist + center.lat);
                                quoteFeature.attributes.angle = angle*180/Math.PI-90;
                                if (quoteFeature.attributes.angle <0) quoteFeature.attributes.angle+=360;
                                quoteArr.push(quoteFeature);
                                var pointAngle = quoteFeature.attributes.angle + 270;
                                if (pointAngle > 360) pointAngle -= 360;
                                quoteArr.push(new OpenLayers.Feature.Vector(ptArr[0],{label:'',quote_id:obj.geometry.id+'_'+i,node:0,angle:pointAngle,color:this.ctrl.redlineColor,symbol:'triangle',radius:4,attach:''}));
                                pointAngle += 180;
                                if (pointAngle > 360) pointAngle -= 360;
                                quoteArr.push(new OpenLayers.Feature.Vector(ptArr[1],{label:'',quote_id:obj.geometry.id+'_'+i,node:1,angle:pointAngle,color:this.ctrl.redlineColor,symbol:'triangle',radius:4,attach:''}));
                            }
                            this.ctrl.redlineLayer.addFeatures(quoteArr);
                            this.handler.layer.destroyFeatures();
                            this.layerSegments.destroyFeatures();
                            this.layerLength.destroyFeatures();
                            //vectorLayer.addFeatures([tmpVector]);
                        },
                    }
                }),
                new OpenLayers.Control.DrawFeature(
                    this.redlineLayer,
                    OpenLayers.Handler.RegularPolygon,
                    {
                        handlerOptions: {sides: 50},
                        iconclass:"glyphicon-white glyphicon-log-in",
                        text:"Quota ortogonale",
                        title:"Inserisci quota ortogonale",
                        eventListeners: {'activate': function(){
                            alert('Funzionalità non disponibile');
                            this.deactivate();
                                //this.map.currentControl.deactivate();
                                //this.map.currentControl=this;
                            }
                        }
                    }
                )
            ],
            geom_edit: [
                new OpenLayers.Control.GeoNoteModifyFeature(
                    this.redlineLayer,
                    {
                        mode: OpenLayers.Control.ModifyFeature.ROTATE,
                        vertexRenderIntent: 'temporary',
                        iconclass:"glyphicon-white glyphicon-repeat",
                        text:"Ruota",
                        title:"Modifica geometrie - ruota",
                        eventListeners: {
                            'activate': function(){
                                this.map.currentControl.deactivate();

                                var origLayerIndex = this.map.getLayerIndex(this.layer);
                                var maxIndex = this.map.getLayerIndex(this.map.layers[this.map.layers.length -1]);
                                if(origLayerIndex < maxIndex) this.map.raiseLayer(this.layer, (maxIndex - origLayerIndex));
                                this.map.resetLayersZIndex();

                                this.map.currentControl=this
                            }
                        }
                    }
                ),
                new OpenLayers.Control.GeoNoteModifyFeature(
                    this.redlineLayer,
                    {
                        mode: OpenLayers.Control.ModifyFeature.RESIZE,
                        vertexRenderIntent: 'temporary',
                        iconclass:"glyphicon-white glyphicon-resize-full",
                        text:"Ridimensiona",
                        title:"Modifica geometrie - ridimensiona",
                        eventListeners: {
                            'activate': function(){
                                this.map.currentControl.deactivate();

                                var origLayerIndex = this.map.getLayerIndex(this.layer);
                                var maxIndex = this.map.getLayerIndex(this.map.layers[this.map.layers.length -1]);
                                if(origLayerIndex < maxIndex) this.map.raiseLayer(this.layer, (maxIndex - origLayerIndex));
                                this.map.resetLayersZIndex();

                                this.map.currentControl=this
                            }
                        }
                    }
                ),
                new OpenLayers.Control.GeoNoteModifyFeature(
                    this.redlineLayer,
                    {
                        mode: OpenLayers.Control.ModifyFeature.DRAG,
                        vertexRenderIntent: 'temporary',
                        iconclass:"glyphicon-white glyphicon-move",
                        text:"Sposta",
                        title:"Modifica geometrie - sposta",
                        eventListeners: {
                            'activate': function(){
                                this.map.currentControl.deactivate();

                                var origLayerIndex = this.map.getLayerIndex(this.layer);
                                var maxIndex = this.map.getLayerIndex(this.map.layers[this.map.layers.length -1]);
                                if(origLayerIndex < maxIndex) this.map.raiseLayer(this.layer, (maxIndex - origLayerIndex));
                                this.map.resetLayersZIndex();

                                this.map.currentControl=this
                            }
                        }
                    }
                ),
                new OpenLayers.Control.GeoNoteModifyFeature(
                    this.redlineLayer,
                    {
                        mode: OpenLayers.Control.ModifyFeature.RESHAPE,
                        vertexRenderIntent: 'temporary',
                        iconclass:"glyphicon-white glyphicon-pencil",
                        text:"Modifica Vertici",
                        title:"Modifica geometrie - modifica vertici",
                        eventListeners: {
                            'activate': function(){
                                this.map.currentControl.deactivate();

                                var origLayerIndex = this.map.getLayerIndex(this.layer);
                                var maxIndex = this.map.getLayerIndex(this.map.layers[this.map.layers.length -1]);
                                if(origLayerIndex < maxIndex) this.map.raiseLayer(this.layer, (maxIndex - origLayerIndex));
                                this.map.resetLayersZIndex();

                                this.map.currentControl=this
                            }
                        }
                    }
                ),
                new OpenLayers.Control.SelectFeature(
                    this.redlineLayer,
                    {
                        ctrl: this,
                        iconclass:"glyphicon-white glyphicon-remove",
                        text:"Cancella",
                        title:"Cancella geometria",
                        eventListeners: {'activate': function(){this.map.currentControl.deactivate();this.map.currentControl=this}},
                        onSelect:function(feature){
                            var self = this;

                            var origLayerIndex = this.map.getLayerIndex(this.layer);
                            var maxIndex = this.map.getLayerIndex(this.map.layers[this.map.layers.length -1]);
                            if(origLayerIndex < maxIndex) this.map.raiseLayer(this.layer, (maxIndex - origLayerIndex));
                            this.map.resetLayersZIndex();

                            self.unselectAll();
                            if (confirm('Eliminare la geometria selezionata?')) {
                                self.layer.removeFeatures([feature]);
                                this.ctrl.savedState = false;
                            }
                        }
                    }
                )
            ],
            note_snap: [
                new OpenLayers.Control(
                    {
                        ctrl: this,
                        type: OpenLayers.Control.TYPE_BUTTON ,
                        iconclass:"glyphicon-white glyphicon-list-alt",
                        text:"Snapping attivato",
                        title:"Snapping attivato",
                        trigger: function(){
                            var ctrl = this.ctrl;
                            var defaultLayers = 'btu_edificato-viabilita-simbologia.btu_edificato_a,btu_edificato-viabilita-simbologia.btu_edificato_l,btu_edificato-viabilita-simbologia.btu_edificato_p';
                            if (!this.active) {
                                this.activate();
                                this.ctrl.controlList.note_snap[1].deactivate();
                                this.ctrl.snapLayer.featureTypes = defaultLayers.split(',');
                                this.ctrl.getSnapFeatures();
                                this.ctrl.snapCtrl.activate();
                                this.map.events.register('moveend', this.ctrl, this.ctrl.getSnapFeatures);
                                var toolsDiv = document.getElementById('geonote_panel_elem_options_note_snap');
                                var group = '';
                                var htmlText = '<div><span class="geonote_options_header">Snap a layer</span><span class="geonote_options_content">';
                                htmlText += '<select class="form-control" id="geonote_snaplayer_text">';
                                htmlText += '<option selected value="' + defaultLayers + '">Predefinito</option>';
                                var layersArr = new Array();
                                for (index in this.ctrl.snapMapQuery.wfsCache){
                                    var featureTypes = this.ctrl.snapMapQuery.wfsCache[index].featureTypes;
                                    for(var i=0;i<featureTypes.length;i++){
                                        if(group != featureTypes[0].group) {
                                            if (group) {
                                                htmlText += '<option value="' + layersArr.join(',') + '">' + group + '</option>';
                                            }
                                            layersArr = new Array();
                                            group = featureTypes[0].group;
                                            //htmlText += '<optgroup label="' + group + '">';
                                        }
                                        layersArr.push(featureTypes[i].typeName);
                                        //htmlText += '<option value="' + featureTypes[i].typeName + '">' + featureTypes[i].title + '</option>';
                                    }
                                };
                                htmlText += '<option value="' + layersArr.join(',') + '">' + group + '</option>';
                                htmlText += '</select>';
                                htmlText +='</span></div>';
                                toolsDiv.innerHTML = htmlText;
                                var selTag = toolsDiv.getElementsByTagName('select').item(0);
                                selTag.addEventListener("change", function(evt) {
                                    ctrl.snapLayer.featureTypes = evt.currentTarget.value.split(',');
                                    ctrl.getSnapFeatures();
                                });
                            }
                        }
                    }
                ),
                new OpenLayers.Control(
                    {
                        ctrl: this,
                        type: OpenLayers.Control.TYPE_BUTTON ,
                        iconclass:"glyphicon-white glyphicon-floppy-saved",
                        text:"Snapping disattivato",
                        title:"Snapping disattivato",
                        trigger: function() {
                            if (!this.active) {
                                this.activate();
                                this.ctrl.controlList.note_snap[0].deactivate();
                                this.ctrl.snapLayer.featureTypes = [];
                                this.ctrl.snapCtrl.deactivate();
                                this.map.events.unregister('moveend', this.ctrl, this.ctrl.getSnapFeatures);
                                var toolsDiv = document.getElementById('geonote_panel_elem_options_note_snap');
                                toolsDiv.innerHTML = '';
                            }
                        }
                    }
                )
            ],
            note_manage: [
                new OpenLayers.Control(
                    {
                        ctrl: this,
                        type: OpenLayers.Control.TYPE_BUTTON ,
                        iconclass:"glyphicon-white glyphicon-list-alt",
                        text:"Nuova",
                        title:"Nuova nota",
                        trigger: this.noteNew
                    }
                ),
                new OpenLayers.Control(
                    {
                        ctrl: this,
                        type: OpenLayers.Control.TYPE_BUTTON ,
                        iconclass:"glyphicon-white glyphicon-floppy-saved",
                        text:"Salva",
                        title:"Salva nota",
                        trigger: this.noteSave
                    }
                ),
                new OpenLayers.Control(
                    {
                        ctrl: this,
                        type: OpenLayers.Control.TYPE_BUTTON ,
                        iconclass:"glyphicon-white glyphicon-floppy-open",
                        text:"Carica",
                        title:"Carica nota",
                        trigger: this.noteLoad
                    }
                ),
                new OpenLayers.Control(
                    {
                        ctrl: this,
                        type: OpenLayers.Control.TYPE_BUTTON ,
                        iconclass:"glyphicon-white glyphicon-floppy-remove",
                        text:"Elimina",
                        title:"Elimina nota",
                        trigger: this.noteDelete
                    }
                )
            ]
        });
    },

    draw:function(){
        // **** Load User an map preferences/configurations
        this.loadUserConfig();
        this.loadSymbols();

        // **** Init vector layers
        this.initRedlineLayer();

        // **** Init snap layer
        var layer;
        for (var i = 0; i < this.map.config.featureTypes.length; i++) {
            layer =  this.map.getLayersByName(this.map.config.featureTypes[i].WMSLayerName)[0];
            if(layer){
                if(typeof(this.snapMapQuery.wfsCache[layer.id])=='undefined') this.snapMapQuery.wfsCache[layer.id] = {featureTypes:[]};
                this.snapMapQuery.wfsCache[layer.id].featureTypes.push(this.map.config.featureTypes[i]);
            }
        };
        this.map.addControls([this.snapMapQuery,this.snapCtrl]);

        var controlIDs = Object.keys(this.controlList);
        for (var k = 0; k < controlIDs.length; k++) {
            var controlID = controlIDs[k];
            var controlDiv = this.mainPanel.getElementsByClassName('geonote_panel_elem_content').namedItem('geonote_panel_elem_content_' + controlID);
            var toolbarCtrl = new OpenLayers.Control.Panel({
                gc_id: 'control-redline-' + controlID,
                baseUrl: GisClientMap.baseUrl,
                createControlMarkup:customCreateControlMarkup,
                div: controlDiv,
                autoActivate:true,
                saveState:true
            });
            toolbarCtrl.addControls(this.controlList[controlID]);
            this.map.addControl(toolbarCtrl);
        };

        this.setColorPanel();

        var isGeodesicMeasure = (this.map.projection == 'EPSG:3857' || this.map.projection == 'EPSG:4326')?true:false;
        this.controlList.create_quote[0].geodesic = isGeodesicMeasure;

        OpenLayers.Control.Panel.prototype.draw.apply(this);
        return this.div
    },

    redraw: function() {
        OpenLayers.Control.Panel.prototype.redraw.apply(this);

        this.div.appendChild(this.mainPanel);

        var divNoteTitle = document.getElementById("geonote_note_title_div");
        var txtNoteHeader = document.getElementById("geonote_note_header");
        var txtNoteTitle = document.getElementById("geonote_note_title");
        var txtNoteHeaderM = document.getElementById("geonote_note_header_mapset");
        var txtNoteTitleM = document.getElementById("geonote_note_mapset");
        var txtNoteHeaderS = document.getElementById("geonote_note_header_status");
        var txtNoteTitleS = document.getElementById("geonote_note_status");

        if (this.active) {
            //divNoteTitle.className = 'olInfoBar';
            txtNoteHeader.className = 'spanHeader';
            txtNoteHeader.textContent = 'Titolo nota:';
            txtNoteTitle.className = 'spanTitle';
            txtNoteTitle.textContent = this.noteTitle;
            txtNoteHeaderM.className = 'spanHeader';
            txtNoteHeaderM.textContent = 'Mappa di riferimento:';
            txtNoteTitleM.className = 'spanTitle';
            txtNoteTitleM.textContent = this.map.config.mapsetTitle;
            txtNoteHeaderS.className = 'spanHeader';
            txtNoteHeaderS.textContent = 'Stato nota:';
            txtNoteTitleS.className = 'spanTitle';
            if (this.noteID && this.noteList.hasOwnProperty(this.noteID)) {
                txtNoteTitleS.textContent = this.noteList[this.noteID].status;
            }
            else {
                txtNoteTitleS.textContent = this.noteDefaultStatus;
            }
            //divNoteTitle.style.width = txtNoteTitle.offsetWidth + 20 + 'px';
        }
        else
        {
            //divNoteTitle.className = '';
            txtNoteHeader.className = '';
            txtNoteHeader.textContent = '';
            txtNoteTitle.className = '';
            txtNoteTitle.textContent = '';
        }

        this.controlList.note_snap[1].activate();
    },

    activate: function() {
        var activated = OpenLayers.Control.prototype.activate.call(this);
        if(activated) {
            this.noteReset();
            this.mainPanel.style.display = 'block';
        }
    },

    deactivate: function() {
        if (!this.savedState && this.redlineLayer.features.length > 0) {
            if (!confirm('Alcuni elementi della nota corrente non sono stati salvati\nSe si disattiva il tool note andranno persi. Continuare?')) {
                return;
            }
        }
        var deactivated = OpenLayers.Control.prototype.deactivate.call(this);
        if(deactivated) {
            this.noteReset();
            this.map.currentControl.deactivate();
            this.map.currentControl=this.map.defaultControl;
            this.mainPanel.style.display = 'none';
        }
    },

    createPanelElement: function(panelID, panelClass, panelTitle, panelFoldable, panelContent) {
        var panelElementDiv = document.createElement("div");
        panelElementDiv.setAttribute('id', 'geonote_panel_elem_' + panelID);
        panelElementDiv.classList.add('geonote_panel_elem');
        if (panelClass) {
            if (!Array.isArray(panelClass)) {
                panelElementDiv.classList.add(panelClass);
            }
            else {
                //panelElementDiv.classList.add(...panelClass);
                panelElementDiv.classList.add.apply(panelElementDiv.classList, panelClass);
            }
        }
        var panelHeaderDiv = document.createElement("div");
        panelHeaderDiv.setAttribute('id', 'geonote_panel_elem_header_' + panelID);
        panelHeaderDiv.classList.add('geonote_panel_elem_header');
        var headerHTML = '';
        if (panelFoldable) {
            headerHTML = '<a href="#" id="geonote_panel_elem_toggle_' + panelID + '"><span id="geonote_panel_elem_toggle_span_' + panelID + '" class="icon-hide-panel"></span></a>';
        }
        if (panelTitle && panelTitle.length > 0) {
            headerHTML += '<span id="geonote_panel_elem_title_' + panelID + '">' + panelTitle + '</span>';
        }
        panelHeaderDiv.innerHTML = headerHTML;
        panelElementDiv.appendChild(panelHeaderDiv);
        var panelContentDiv = document.createElement("div");
        panelContentDiv.setAttribute('id', 'geonote_panel_elem_content_' + panelID);
        panelContentDiv.classList.add('geonote_panel_elem_content');
        if (panelContent) {
            panelContentDiv.innerHTML = panelContent;
        }
        panelElementDiv.appendChild(panelContentDiv);
        var panelOptionsDiv = document.createElement("div");
        panelOptionsDiv.setAttribute('id', 'geonote_panel_elem_options_' + panelID);
        panelOptionsDiv.classList.add('geonote_panel_elem_options');
        panelElementDiv.appendChild(panelOptionsDiv);
        this.mainPanel.appendChild(panelElementDiv);

        if (panelFoldable) {
            var foldA = panelHeaderDiv.getElementsByTagName('a').item(0);
            var foldS = foldA.getElementsByTagName('span').item(0);
            foldA.addEventListener("click", function(evt) {
                event.stopPropagation();
                if (foldS.classList.contains('icon-hide-panel')) {
                    foldS.classList.remove('icon-hide-panel');
                    foldS.classList.add('icon-show-panel');
                    panelContentDiv.style.display = 'none';
                }
                else {
                    foldS.classList.remove('icon-show-panel');
                    foldS.classList.add('icon-hide-panel');
                    panelContentDiv.style.display = 'block';
                }
            });
        }
    },

    managePanels: function() {
        var panels = this.ctrl.mainPanel.getElementsByClassName(this.panelclass);
        var allPanels = this.ctrl.mainPanel.getElementsByClassName('geonote_panel_elem');
        var isActive = this.active;
        this.ctrl.noteColorPicker.panel = this.panelclass;
        if (this.panelclass == "geonote_panel_cls_draw") {
            this.ctrl.noteColorPicker.setHex(this.ctrl.redlineColor);
        }
        else if (this.panelclass == "geonote_panel_cls_edit") {
            this.ctrl.noteColorPicker.setHex(this.ctrl.redlineColorM);
        }
        else {
            var toolsDiv = document.getElementById('geonote_panel_elem_options_note_manage');
            toolsDiv.innerHTML = '';
        }
        for (var k=0; k<this.ctrl.controls.length; k++) {
            this.ctrl.controls[k].deactivate();
        }
        if (isActive) {
            this.deactivate();
        }
        else {
            this.activate();
        }
        for (var i=0; i < allPanels.length; i++) {
            allPanels.item(i).style.display = 'none';
        }
        if (!isActive) {
            for (var i=0; i < panels.length; i++) {
                panels.item(i).style.display = 'block';
            }
        }
    },

    setColorPanel: function() {
        var self=this;
        this.noteColorPicker = ColorPicker(
                self.mainPanel.getElementsByClassName('cp-default').item(0),
                function(hex, hsv, rgb) {
                    self.mainPanel.getElementsByClassName("geonote_colorpicker_display").item(0).style.backgroundColor = hex;
                    self.mainPanel.getElementsByClassName("geonote_colorpicker_header_badge").item(0).style.color = hex;
                    if (self.noteColorPicker.panel == "geonote_panel_cls_draw") {
                        self.redlineColor = hex;
                    }
                    else if (self.noteColorPicker.panel == "geonote_panel_cls_edit") {
                        self.redlineColorM = hex;
                        for (var i=0; i<self.redlineLayer.selectedFeatures.length; i++) {
                            self.redlineLayer.selectedFeatures[i].attributes.color = hex;
                            if (self.redlineLayer.selectedFeatures[i].attributes.attach) {
                                self.redlineLayer.selectedFeatures[i].attributes.attach = self.updateQueryString(self.redlineLayer.selectedFeatures[i].attributes.attach,{'color':hex.substring(1)});
                            }
                        }
                    }
                    for (var i=0; i< self.redlineColorPalette.length; i++) {
                        var colorBtn = self.mainPanel.querySelector('#geonote_color_palette_item_'+i);
                        if (hex == self.redlineColorPalette[i]) {
                            colorBtn.classList.remove('olControlItemInactive');
                            colorBtn.classList.add('olControlItemActive');
                        }
                        else {
                            colorBtn.classList.remove('olControlItemActive');
                            colorBtn.classList.add('olControlItemInactive');
                        }
                    }
                });

        var panelPalette = this.mainPanel.querySelector('#geonote_color_palette');
        panelPalette.innerHTML = '';
        var i = 0;
        for (i=0; i< this.redlineColorPalette.length; i++) {
            panelPalette.innerHTML += '<span><a id="geonote_color_palette_item_'+i+'" data-geonote-palette_color="'+this.redlineColorPalette[i]+'" class="olButton olControlItemInctive" style="background-color: '+this.redlineColorPalette[i]+';"></a></span>';
        }

        for (i=0; i< this.redlineColorPalette.length; i++) {
            var colorBtn = this.mainPanel.querySelector('#geonote_color_palette_item_'+i);
            colorBtn.addEventListener("click", function(evt) {
                self.noteColorPicker.setHex(evt.currentTarget.getAttribute('data-geonote-palette_color'));
            });
        }

        var btnPalette = this.mainPanel.querySelector('#geonote_color_palette_switch');
        btnPalette.addEventListener("click", function(evt) {
            evt.currentTarget.classList.remove('olControlItemInactive');
            evt.currentTarget.classList.add('olControlItemActive');
            orBtn = document.getElementById('geonote_color_colorpicker_switch');
            orBtn.classList.remove('olControlItemActive');
            orBtn.classList.add('olControlItemInactive');
            document.getElementById('geonote_color_palette').style.display = 'block';
            document.getElementById('geonote_colorpicker').style.display = 'none';
        });
        var btnColorpicker = this.mainPanel.querySelector('#geonote_color_colorpicker_switch');
        btnColorpicker.addEventListener("click", function(evt) {
            evt.currentTarget.classList.remove('olControlItemInactive');
            evt.currentTarget.classList.add('olControlItemActive');
            orBtn = document.getElementById('geonote_color_palette_switch');
            orBtn.classList.remove('olControlItemActive');
            orBtn.classList.add('olControlItemInactive');
            document.getElementById('geonote_color_palette').style.display = 'none';
            document.getElementById('geonote_colorpicker').style.display = 'block';
        });

        this.noteColorPicker.panel = "geonote_panel_cls_draw";
        this.noteColorPicker.setHex(this.redlineColor);
    },

    createPopup: function(popupContent,popupID) {
        var noteModalBackgound = document.createElement('div')
        noteModalBackgound.classList.add('geonote_popup_modal_background');
        var notePopup = document.createElement('div');
        notePopup.setAttribute('id', 'geonote-popup');
        notePopup.classList.add('geonote_popup_modal_popup');
        notePopup.innerHTML = '<div><div id="geonote-popup_close" class="olPopupCloseBox" style="width: 17px; height: 17px; position: absolute; right: 5px; top: 5px;"></div></div>'
        notePopup.innerHTML += popupContent;
        noteModalBackgound.appendChild(notePopup);
        document.body.appendChild(noteModalBackgound);
        noteModalBackgound.addEventListener('click', function (evt) {
            if (evt.target.className === 'geonote_popup_modal_background') {
                evt.target.remove();
            }
        });
        var closeBox = notePopup.getElementsByClassName("olPopupCloseBox").item(0);
        closeBox.addEventListener('click', function (evt) {
            var modal = document.querySelectorAll('.geonote_popup_modal_background')
            if (modal) {
                modal.item(modal.length-1).remove();
            }
        });
    },

    zoomEnd: function() {
        for (var i=0; i<this.redlineLayer.features.length; i++) {
            var ftObj = this.redlineLayer.features[i];
            if (ftObj.attributes.attach) {
                var oldRes = ftObj.attributes.resolution;
                var oldSize = ftObj.attributes.attachsize;
                var res = this.map.getResolution();
                var newSize = oldSize*oldRes/res;
                newSize = Math.round(newSize);
                ftObj.attributes.resolution = res;
                ftObj.attributes.attachsize = newSize;
                ftObj.attributes.attach = this.updateQueryString(ftObj.attributes.attach,{'size':newSize});
            }
            if (ftObj.attributes.centroid) {
                var center = ftObj.geometry.getBounds().getCenterLonLat();
                var ptArr = ftObj.geometry.getVertices();
                var dx = ptArr[1].x-ptArr[0].x;
                var dy = ptArr[1].y-ptArr[0].y;
                var angle1 = Math.atan2(dy,dx);
                var dist = 12 * this.map.getResolution();
                ftObj.attributes.centroid = new OpenLayers.Geometry.Point(center.lon - Math.sin(angle1) * dist,Math.cos(angle1) * dist + center.lat);
            }
        }
        this.redlineLayer.redraw();
    },

    initRedlineLayer: function() {
        var ctrl = this;

        this.redlineLayer.protocol = new OpenLayers.Protocol.HTTP({
            url: this.serviceURL,
            format: new OpenLayers.Format.GeoJSON({
                ignoreExtraDims: true
                //internalProjection: mapPanel.map.baseLayer.projection
                //externalProjection: wgs84
            }),
            params:{
                PROJECT: GisClientMap.projectName,
                MAPSET: GisClientMap.mapsetName,
                SRS: this.map.projection
            },
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
        });

        this.map.addLayer(this.redlineLayer);
        this.redlineLayer.events.on({
            "loadend" : ctrl.noteLoaded,
            //"sketchstarted" : ctrl.setFeatureDefaults,
            "sketchcomplete": ctrl.styleFeature,
            "beforefeaturemodified": ctrl.styleFeature,
            "beforefeaturesadded": ctrl.beforeFeaturesAdded,
            "featureadded": ctrl.featureAdded,
            "featuremodified": ctrl.featureModified,
            "featureremoved": ctrl.featureModified,
            "vertexmodified": ctrl.featureModified,
            scope: ctrl
        });
        // **** Add snap layers
        this.map.addLayer(this.snapLayer);
        this.snapLayer.events.on({
            "beforefeatureadded": function(obj) {
                obj.feature.style = {display: 'none'};
            },
            scope: ctrl
        });
    },

    beforeFeaturesAdded: function(obj) {
        var layerLocal = this.redlineLayer;
        for (var i = obj.features.length-1; i>=0; i--) {
            var featObj = obj.features[i];
            if (!featObj.attributes.angle) {
                featObj.attributes.angle = 0;
            }
            if (!featObj.attributes.radius) {
                featObj.attributes.radius = 0;
            }
            if (featObj.attributes.quote_id && featObj.geometry.CLASS_NAME == "OpenLayers.Geometry.LineString") {
                featObj.attributes.fontsize = '12px';
                if (!featObj.attributes.hasOwnProperty('centroid')) {
                    var ptArr = featObj.geometry.getVertices();
                    var dx = ptArr[1].x-ptArr[0].x;
                    var dy = ptArr[1].y-ptArr[0].y;
                    var angle1 = Math.atan2(dy,dx);
                    var dist = 12 * this.map.getResolution();
                    var center = featObj.geometry.getBounds().getCenterLonLat();
                    featObj.attributes.centroid = new OpenLayers.Geometry.Point(center.lon - Math.sin(angle1) * dist,Math.cos(angle1) * dist + center.lat);
                }
                else {
                    var popupBtnId = 'geonote_setlabel_button_' + featObj.id;
                    var popupTxtId = 'geonote_set_label_quote_text_' + featObj.id;
                    var popupHtml = '<div class="geonote-popup-content"><div class="geonote-popup-form-group"><label for="geonote_label_text">Testo etichetta quota</label>';
                    popupHtml += '<textarea name="text" class="form-control" id="' + popupTxtId + '">' + featObj.attributes.label + '</textarea>';
                    popupHtml += '</div><div class="geonote-popup-buttons"><a  id="' + popupBtnId + '" class="geonote-popup-btn" title="Imposta etichetta"><span>Imposta etichetta</span></a></div></div>';
                    this.createPopup(popupHtml);
                    var noteBtn = document.getElementById(popupBtnId);
                    noteBtn.addEventListener('click', function (evt) {
                        evt.preventDefault();
                        var featureID = evt.target.parentNode.id.replace('geonote_setlabel_button_','');
                        var valueTxt = document.getElementById('geonote_set_label_quote_text_' + featureID);
                        var innerFeature = layerLocal.getFeatureById(featureID);
                        innerFeature.attributes.label = valueTxt.value;
                        innerFeature.layer.drawFeature(innerFeature);
                        var modal = document.querySelectorAll('.geonote_popup_modal_background');
                        if (modal) {
                            modal.item(modal.length-1).remove();
                        }
                    });
                }
            }
        }
    },

    featureAdded: function(obj) {

    },

    featureModified: function(obj) {
        obj.feature.attributes.color = this.redlineColorM;
        if (obj.feature.attributes.attach) {
            obj.feature.attributes.attach = this.updateQueryString(obj.feature.attributes.attach,{'color':this.redlineColorM.substring(1)});
        }
        this.savedState = false;
    },

    styleFeature: function(obj) {
        this.savedState = false;
        if (obj.type == "beforefeaturemodified") {
            this.noteColorPicker.setHex(obj.feature.attributes.color);
        }
        else {
            obj.feature.attributes.color = this.redlineColor;
        }
        if (!obj.feature.attributes.labelxoff)
            obj.feature.attributes.labelxoff = 0;
        if (!obj.feature.attributes.labelyoff)
            obj.feature.attributes.labelyoff = 12;
        if (!obj.feature.attributes.label)
            obj.feature.attributes.label = '';
        if (!obj.feature.attributes.attach)
            obj.feature.attributes.attach = '';
        if (!obj.feature.attributes.attachsize)
            obj.feature.attributes.attachsize = clientConfig.GEONOTE_SYMBOL_SIZE;
        if (!obj.feature.attributes.symbol)
            obj.feature.attributes.symbol = 'circle';
        if (!obj.feature.attributes.radius)
            obj.feature.attributes.radius = 2;
        if (!obj.feature.attributes.strokewidth)
            obj.feature.attributes.strokewidth = 1;
        if (!obj.feature.attributes.dashstyle)
            obj.feature.attributes.dashstyle = 'solid';
        if (!obj.feature.attributes.fontsize)
            obj.feature.attributes.fontsize = '12px';
        if (!obj.feature.attributes.angle)
            obj.feature.attributes.angle = 0;
        //obj.feature.attributes.resolution = this.map.getResolution();

        obj.feature.attributes.resolution = this.map.resolutions[clientConfig.GEONOTE_SYMBOL_RES];
        var res = this.map.getResolution();
        if (obj.feature.attributes.resolution != res) {
            var newSize = clientConfig.GEONOTE_SYMBOL_SIZE*obj.feature.attributes.resolution/res;
            newSize = Math.round(newSize);
            obj.feature.attributes.resolution = res;
            obj.feature.attributes.attachsize = newSize;
        }


        var configNodes = document.querySelectorAll('[data-geonote-attr]');
        for (var i = 0; i < configNodes.length; i++) {
            var confNode = configNodes[i];
            var confAttr = confNode.getAttribute('data-geonote-attr');
            if (confAttr == 'attach') {
                obj.feature.attributes[confAttr] = confNode.value + '&color=' + this.redlineColor.substring(1) + '&size=' + obj.feature.attributes.attachsize;
            }
            else if (confAttr == 'radius') {
                obj.feature.attributes[confAttr] = confNode.value;
                obj.feature.attributes.labelyoff = parseFloat(obj.feature.attributes.labelyoff) + parseFloat(confNode.value);
            }
            else if (confAttr == 'orientation' && confNode.value) {
                var lastFeature = null;
                if (this.redlineLayer.features.length > 0) {
                    lastFeature = this.redlineLayer.features[this.redlineLayer.features.length-1];
                }
                if (lastFeature && lastFeature.style) {
                    // **** Set angle for previous feature
                    var dx = obj.feature.geometry.x - lastFeature.geometry.x;
                    var dy = obj.feature.geometry.y - lastFeature.geometry.y;
                    var angle = Math.atan2(dx,dy);
                    var angle1 = Math.atan2(dy,dx);
                    angle1 *= 180 / Math.PI;
                    lastFeature.attributes.angle = angle*180/Math.PI-90;
                    if (lastFeature.attributes.labelxoff || lastFeature.attributes.labelyoff) {
                        var res = this.redlineLayer.map.getResolution();
                        var xdist = lastFeature.attributes.labelxoff*res;
                        var ydist = lastFeature.attributes.labelyoff*res;
                        var offPoint = new OpenLayers.Geometry.Point(lastFeature.geometry.x+xdist,lastFeature.geometry.y+ydist);
                        offPoint.rotate(angle1, lastFeature.geometry);
                        lastFeature.attributes.labelxoff = (offPoint.x - lastFeature.geometry.x)/res;
                        lastFeature.attributes.labelyoff = (offPoint.y - lastFeature.geometry.y)/res;
                    }
                    lastFeature.style = null;
                    this.redlineLayer.redraw();
                    return false;
                }
                else {
                    var init_style = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style.temporary);
                    obj.feature.style = OpenLayers.Util.extend(init_style, this.redlineLayer.styleMap.styles.temporary.defaultStyle);
                }
            }
            else {
                obj.feature.attributes[confAttr] = confNode.value;
            }
        }
        if (obj.feature.attributes.quote_id) {
            var quotesArr = this.redlineLayer.getFeaturesByAttribute('quote_id',obj.feature.attributes['quote_id']);
            for (var i=0; i<quotesArr.length; i++) {
                if (quotesArr[i].attributes.hasOwnProperty('node')) {
                    this.redlineLayer.destroyFeatures([quotesArr[i]]);
                    //self.layer.drawFeature(quoteEndpoint);
                }
            }
        }
    },

    getSnapFeatures: function(obj) {
        var featureTypesArr = this.snapLayer.featureTypes;
        if (!Array.isArray(featureTypesArr ) || featureTypesArr.length < 1) {
            return;
        }
        this.snapLayer.destroyFeatures();
        if (this.map.getScale() > this.snapMaxScale) {
            return;
        }
        var queryLayers = [];
        for (var j=0; j<featureTypesArr.length; j++) {
            var layerTmp = null;
            for (index in this.snapMapQuery.wfsCache){
                for(var i=0;i<this.snapMapQuery.wfsCache[index].featureTypes.length;i++){
                    if(this.snapMapQuery.wfsCache[index].featureTypes[i].typeName == featureTypesArr[j]) layerTmp = this.map.getLayer(index);
                }
            }
            if (layerTmp && layerTmp.calculateInRange()) {
                for (var k=0; k<queryLayers.length; k++) {
                    if (queryLayers[k].id === layerTmp.id) break;
                }
                if (k == queryLayers.length) {
                    queryLayers.push(layerTmp);
                }
            }
        }

        var snapExtent = this.map.getExtent();
        this.snapMapQuery.snapExtent = snapExtent.toString();

        if (queryLayers.length > 0 && !this.snapMapQuery.busy) {
            this.snapMapQuery.busy = true;
            var loadingControl = GisClientMap.map.getControlsByClass('OpenLayers.Control.LoadingPanel')[0];
            loadingControl.maximizeControl();
            this.snapMapQuery.layers = queryLayers;
            this.snapMapQuery.queryFeatureType = featureTypesArr.join(',');
            this.snapMapQuery.activate();
            this.snapMapQuery.select(snapExtent.toGeometry());
            this.snapMapQuery.deactivate();
            //loadingControl.minimizeControl();
        }
    },

   noteSave: function () {
       var toolsDiv = document.getElementById('geonote_panel_elem_options_note_manage');
       toolsDiv.innerHTML = '<div class="geonote-popup-form">\
           <div class="geonote-popup-form-group">\
               <label for="geonote_note_name">Titolo Nota</label>\
               <input type="text" class="form-control" id="geonote_note_name">\
           </div>\
       </div>\
       <div class="geonote-popup-buttons">\
           <a  id="geonote_save" class="olButton olControlItemInactive" title="Salva nota">\
               <span>Salva nota</span>\
           </a>\
       </div>';
       var self = this;
       document.getElementById("geonote_note_name").value = self.ctrl.noteTitle;
       document.getElementById("geonote_save").addEventListener("click", function (evt) {
           var noteTitle = document.getElementById("geonote_note_name").value;

           var reqParams = self.ctrl.redlineLayer.protocol.params;


            reqParams["TITLE"] = noteTitle;
            reqParams["REQUEST"] = 'SaveLayer';
            //self.ctrl.redlineLayer.protocol.params["SRS"] = self.ctrl.map.projection;
            if (self.ctrl.noteID)
                reqParams["REDLINEID"] = self.ctrl.noteID;
            else
                reqParams["REDLINEID"] = null;

            var geojson_format = new OpenLayers.Format.GeoJSON();
            reqParams.features = geojson_format.write(self.ctrl.redlineLayer.features);

            var request = OpenLayers.Request.POST({
                url: self.ctrl.serviceURL,
                data: OpenLayers.Util.getParameterString(reqParams),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                callback: function(response) {
                    var self = this;
                    if(!response || typeof(response) != 'object' || !response.status || response.status != 200) {
                        return alert('Errore di sistema');
                    }

                    if (!response.responseText) {
                            return alert('Errore di sistema, impossibile accedere alle note salvate');
                    }

                    var responseObj = JSON.parse(response.responseText);

                    if (responseObj.error) {
                        alert('Errore in salvataggio nota:' + responseObj.error);
                        this.savedState = false;
                        return;
                    }

                    this.noteTitle = responseObj.redlineTitle;
                    this.noteID = responseObj.redlineId;
                    this.redraw();
                    this.savedState = true;

                    this.noteLoader(this.noteID);
                },
                scope: self.ctrl
            });

        }, false);
   },

   saveSuccess: function (response) {

    },

    saveFail: function(response) {


    },

    noteLoad: function(redlineID) {
        var toolsDiv = document.getElementById('geonote_panel_elem_options_note_manage');
        toolsDiv.innerHTML = '<div class="geonote-popup-form">\
            <div class="geonote-popup-form-group">\
                <label for="geonote_note_list">Carica Nota</label>\
                <select size="4" class="form-control" id="geonote_note_list"></select>\
            </div>\
        </div>\
        <div class="geonote-popup-buttons">\
        <a  id="geonote_load" class="olButton olControlItemInactive" title="Carica nota">\
            <span>Carica nota</span>\
        </a>';
        var self = this;

        self.map.currentControl.deactivate();
        self.map.currentControl=self.map.defaultControl;

        var params = {
            PROJECT: self.ctrl.redlineLayer.protocol.params['PROJECT'],
            MAPSET: self.ctrl.redlineLayer.protocol.params['MAPSET'],
            SRS: self.ctrl.redlineLayer.protocol.params['SRS'],
            REQUEST: 'GetLayers'
        };
        var request = OpenLayers.Request.POST({
            url: self.ctrl.serviceURL,
            data: OpenLayers.Util.getParameterString(params),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            callback: function(response) {
                var self = this;
                if(!response || typeof(response) != 'object' || !response.status || response.status != 200) {
                    return alert('Errore di sistema');
                }

                if (!response.responseText) {
                        return alert('Errore di sistema, impossibile accedere alle note salvate');
                }

                var responseObj = JSON.parse(response.responseText);

                if (responseObj.layers) {
                    for (var i=0; i < responseObj.layers.length; i++){
                        var noteOpt = document.createElement( 'option' );
                        noteOpt.value = responseObj.layers[i].redline_id;
                        noteOpt.text = responseObj.layers[i].redline_title;
                        document.getElementById("geonote_note_list").add(noteOpt);
                        this.ctrl.noteList[responseObj.layers[i].redline_id] = {
                            title : responseObj.layers[i].redline_title,
                            status :  responseObj.layers[i].redline_status
                        }
                    }
                }

                document.getElementById("geonote_load").addEventListener("click", function (evt) {
                    if (!self.ctrl.savedState && self.ctrl.redlineLayer.features.length > 0) {
                        if (!confirm('Alcuni elementi della nota corrente non sono stati salvati\nSe si procede con il caricamento andranno persi. Continuare?')) {
                            return;
                        }
                    }
                    var redlineList = document.getElementById("geonote_note_list");
                    var redlineID = redlineList.value;

                    if (!redlineID)
                        return;

                    var redlineTitle = redlineList.options[redlineList.selectedIndex].innerHTML;

                    self.ctrl.noteTitle = redlineTitle;
                    self.ctrl.noteID = redlineID;
                    self.ctrl.redraw();

                    self.ctrl.noteLoader(redlineID);

                    if(self.ctrl.popup) {
                        self.ctrl.map.removePopup(self.ctrl.popup);
                        self.ctrl.popup.destroy();
                        self.ctrl.popup = null;
                    }
                });
            },
            scope: this
        });
    },

    noteLoader: function(redlineID) {
        this.loading =true;
        this.redlineLayer.removeAllFeatures();
        this.redlineLayer.protocol.params["REQUEST"] = 'GetLayer';
        this.redlineLayer.protocol.params["REDLINEID"] = redlineID;
        this.redlineLayer.strategies[1].load();
        var toolsDiv = document.getElementById('geonote_panel_elem_options_note_manage');
        toolsDiv.innerHTML = '';
    },

    noteLoaded: function(obj) {
        if (obj.response.priv.status != 200) {
            alert ("Caricamento nota fallito");
            this.noteTitle = this.noteDefaultTitle;
            this.noteID = null;
            this.savedState = false;
            this.loading = false;
        }
        this.redlineLayer.redraw();
        this.savedState = true;
        this.loading = false;

        if (this.redlineLayer.features.length > 0)
            this.map.zoomToExtent(this.redlineLayer.getDataExtent());
    },

    noteDelete: function() {
        var toolsDiv = document.getElementById('geonote_panel_elem_options_note_manage');
        toolsDiv.innerHTML = '';
        if (this.ctrl.redlineLayer.features.length == 0)
            return;

        if (confirm('Eliminare la nota corrente?')) {
            if (this.ctrl.noteID) {
                var self = this;
                var params = {
                    PROJECT: self.ctrl.redlineLayer.protocol.params['PROJECT'],
                    MAPSET: self.ctrl.redlineLayer.protocol.params['MAPSET'],
                    REDLINEID: this.ctrl.noteID,
                    REQUEST: 'DeleteLayer'
                };
                var request = OpenLayers.Request.POST({
                    url: this.ctrl.serviceURL,
                    data: OpenLayers.Util.getParameterString(params),
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    callback: function(response) {
                        if(!response || typeof(response) != 'object' || !response.status || response.status != 200) {
                            return alert('Errore di sistema');
                        }

                        if (!response.responseText) {
                                return alert('Errore di sistema, impossibile eliminare la nota corrente');
                        }

                        var responseObj = JSON.parse(response.responseText);

                        if (responseObj.error) {
                                alert('Errore in eliminazione nota:' + responseObj.error);
                                this.ctrl.savedState = false;
                                return;
                        }

                        this.ctrl.noteReset();

                    },
                    scope: this
                });
            }
            else {
                this.ctrl.noteReset();
            }
        }
    },

    noteNew: function() {
        if (!this.ctrl.savedState && this.ctrl.redlineLayer.features.length > 0) {
            if (!confirm('Alcuni elementi della nota corrente non sono stati salvati\nSe si procede con la creazione di una nuova nota andranno persi. Continuare?')) {
                return;
            }
        }
        this.ctrl.noteReset();
        var toolsDiv = document.getElementById('geonote_panel_elem_options_note_manage');
        toolsDiv.innerHTML = '';
    },

    noteReset: function () {
        this.redlineLayer.removeAllFeatures();
        this.noteTitle = this.noteDefaultTitle;
        this.noteID = null;
        this.savedState = false;
        this.redraw();
    },

    parseQueryString: function(url) {
        var match,
            pl     = /\+/g,  // Regex for replacing addition symbol with a space
            search = /([^&=]+)=?([^&]*)/g,
            decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
            query  = url.split('?')[1];

        var urlParams = {};
        while (match = search.exec(query))
            urlParams[decode(match[1])] = decode(match[2]);

        return urlParams;
    },

    updateQueryString: function(url, updateItems) {
        var queryStringItems = this.parseQueryString(url);
        for (var item in updateItems) {
            queryStringItems[item] = updateItems[item];
        };

        var newUrl = url.split('?')[0] + '?';
        for (var item in queryStringItems) {
            newUrl += item + '=' + queryStringItems[item] + '&';
        };
        return newUrl;
    },

    loadSymbols: function() {
        var fontFiles = this.symbolFontFiles;
        var pendingRequests = fontFiles.length;
        var symbolArr = [];
        for (var k=0; k<fontFiles.length; k++) {
            OpenLayers.Request.GET({
                url: this.baseUrl + '/admin/ajax/dbList.php',
                params: {
                    project: this.map.config.projectName,
                    prm_livello: 'style',
                    selectedField: 'symbol_name',
                    font_name: fontFiles[k]
                },
                scope: this,
                callback: function(response, conf, url) {
                    var self = this;
                    if(!response || typeof(response) != 'object' || !response.status || response.status != 200) {
                        return alert('Errore di sistema');
                    }

                    if (!response.responseText) {
                        return;
                    }

                    var responseObj = JSON.parse(response.responseText);

                    if (!responseObj.result || responseObj.result != 'ok') {
                        var errMessage = 'Errore in estrazione simboli da font';
                        if (responseObj.error)
                            errMessage += ' - Dettagli: ' + responseObj.error;
                        return alert (errMessage);
                    }
                    for(var i=0;i<responseObj.data.length;i++){
                        symbolArr.push(responseObj.data[i].symbol);
                    }
                    pendingRequests--;
                    if (pendingRequests <= 0) {
                        symbolArr.sort();
                        this.symbolArr = symbolArr;
                    }
                    // **** Set favorites
                }
            });
        }
    },

    setFavoriteSymbol: function(symbol) {
        if (symbol) {
            var index = (this.config.symbols[this.map.config.mapsetName]).indexOf(symbol);
            if (index > -1) {
                (this.config.symbols[this.map.config.mapsetName]).splice(index, 1);
                var symbolFavRem = document.getElementById('geonote_symbol_fav_'+symbol);
                symbolFavRem.classList.remove('glyphicon-star');
                symbolFavRem.classList.add('glyphicon-star-empty');
            }
            else {
                this.config.symbols[this.map.config.mapsetName].push(symbol);
                this.config.symbols[this.map.config.mapsetName].sort();
            }
            // **** save in settings
            this.saveUserConfig();
        }

        var symbolListFavCtrl = document.getElementById("geonote_symbol_list_fav");
        if (this.config.symbols[this.map.config.mapsetName].length < 9) {
            var hList = this.config.symbols[this.map.config.mapsetName].length * 28;
            symbolListFavCtrl.style.height = hList + 'px';
        }
        else {
            symbolListFavCtrl.style.height = '250px';
        }
        var baseUrl = this.baseUrl;
        symbolListFavCtrl.innerHTML = '';
        for (var j=0; j<this.config.symbols[this.map.config.mapsetName].length; j++) {
            symbolListFavCtrl.innerHTML += '<div><span class="geonote_options_header geonote_symbol_label">' + this.config.symbols[this.map.config.mapsetName][j] +
            '</span><span class="geonote_options_content"><a id="geonote_symbol_btn_fav_' + this.config.symbols[this.map.config.mapsetName][j] + '" data-geonote-symbol="' + this.config.symbols[this.map.config.mapsetName][j] + '" class="olButton olControlItemInctive"><img src="' +
            baseUrl + '/admin/getImage.php?table=symbol&id=' + this.config.symbols[this.map.config.mapsetName][j] + '"></a></span>';
            var symbolFav = document.getElementById('geonote_symbol_fav_'+this.config.symbols[this.map.config.mapsetName][j]);
            if (symbolFav.classList.contains('glyphicon-star-empty')) {
                symbolFav.classList.remove('glyphicon-star-empty');
                symbolFav.classList.add('glyphicon-star');
            }
        }

        for (var i=0; i<this.config.symbols[this.map.config.mapsetName].length; i++) {
            var symbolBtn = document.getElementById('geonote_symbol_btn_fav_'+this.config.symbols[this.map.config.mapsetName][i]);
            symbolBtn.addEventListener("click", function(evt) {
                var symbolHCtrl = document.getElementById("geonote_symbol_text");
                var symbolOld = symbolHCtrl.getAttribute('data-geonote-symbol');
                var symbolNew = evt.currentTarget.getAttribute('data-geonote-symbol');
                var ctrlOld = document.getElementById('geonote_symbol_btn_fav_' + symbolOld);
                if (ctrlOld) {
                    ctrlOld.classList.remove('olControlItemActive');
                    ctrlOld.classList.add('olControlItemInactive');
                }
                ctrlOld = document.getElementById('geonote_symbol_btn_' + symbolOld);
                ctrlOld.classList.remove('olControlItemActive');
                ctrlOld.classList.add('olControlItemInactive');
                symbolHCtrl.setAttribute('value', baseUrl + '/admin/getImage.php?table=symbol&id=' + symbolNew + '&transparency=1');
                symbolHCtrl.setAttribute('data-geonote-symbol', symbolNew);
                evt.currentTarget.classList.remove('olControlItemInactive');
                evt.currentTarget.classList.add('olControlItemActive');
            });
        }
    },

    loadUserConfig: function() {
        var request = OpenLayers.Request.POST({
            url: this.serviceURL,
            data: OpenLayers.Util.getParameterString({'REQUEST':'GetUser'}),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            callback: function(response) {
                if(!response || typeof(response) != 'object' || !response.status || response.status != 200) {
                    return alert('Errore di sistema');
                }

                if (!response.responseText) {
                        return alert('Errore di sistema, impossibile cericare configurazoine utente');
                }

                var responseObj = JSON.parse(response.responseText);
                this.config = {};

                if (responseObj.config) {
                    this.config = JSON.parse(responseObj.config);
                }
                // **** Set defaults
                if (!this.config.hasOwnProperty('symbols')) {
                    this.config.symbols = {};
                }
                if (!this.config.symbols.hasOwnProperty(this.map.config.mapsetName)) {
                    this.config.symbols[this.map.config.mapsetName] = [];
                }
            },
            scope: this
        });
    },

    saveUserConfig: function() {
        var params = {
            CONFIG: JSON.stringify(this.config),
            REQUEST: 'SaveUser'
        };
        var request = OpenLayers.Request.POST({
            url: this.serviceURL,
            data: OpenLayers.Util.getParameterString(params),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            callback: function(response) {
                if(!response || typeof(response) != 'object' || !response.status || response.status != 200) {
                    return alert('Errore di sistema');
                }

                if (!response.responseText) {
                        return alert('Errore di sistema, impossibile salvare configurazione utente');
                }

                var responseObj = JSON.parse(response.responseText);

                if (responseObj.result != 'ok') {
                    return alert('Errore, impossibile salvare configurazione utente')
                }
            },
            scope: this
        });
    }

 });
