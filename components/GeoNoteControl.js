// **** GeoNote Toolbar control
window.GCComponents["Controls"].addControl('control-redline', function(map){
        return new OpenLayers.GisClient.geoNoteToolbar({
        gc_id: 'control-redline',
        baseUrl: GisClientMap.baseUrl,
        createControlMarkup:customCreateControlMarkup,
        div:document.getElementById("map-toolbar-redline"),
        autoActivate:false,
        saveState:true,
        symbolFontFiles: (clientConfig.GEONOTE_SYMBOL_MAP.hasOwnProperty(GisClientMap.mapsetName)?clientConfig.GEONOTE_SYMBOL_MAP[GisClientMap.mapsetName]:[]),
        redlineColor: (clientConfig.GEONOTE_DEFAULTS_MAP.hasOwnProperty(GisClientMap.mapsetName)?clientConfig.GEONOTE_DEFAULTS_MAP[GisClientMap.mapsetName].color:clientConfig.GEONOTE_COLOR),
        redlineColorM: (clientConfig.GEONOTE_DEFAULTS_MAP.hasOwnProperty(GisClientMap.mapsetName)?clientConfig.GEONOTE_DEFAULTS_MAP[GisClientMap.mapsetName].color:clientConfig.GEONOTE_COLOR),
        redlineColorPalette: clientConfig.GEONOTE_COLOR_PALETTE,
        defaultPointRadius: clientConfig.GEONOTE_POINT_RADIUS,
        defaultStrokeWidth: clientConfig.GEONOTE_STROKE_WIDTH
    });
});

// **** Toolbar button
window.GCComponents["SideToolbar.Buttons"].addButton (
    'button-redline',
    'Prima Nota',
    'glyphicon-white glyphicon-pencil',
    function() {
        if (sidebarPanel.handleEvent || typeof(sidebarPanel.handleEvent) === 'undefined')
        {
            var ctrl = this.map.getControlsBy('gc_id', 'control-redline')[0];

            if (ctrl.active) {
                ctrl.deactivate();
                this.deactivate();
                $('#map-toolbars').css('top', '2px');
            }
            else
            {
                ctrl.activate();
                this.activate();
                var nShift = $('#map-toolbars-edit').height() + 3;
                $('#map-toolbars').css('top', nShift + 'px');
            }
            if (typeof(sidebarPanel.handleEvent) !== 'undefined')
                sidebarPanel.handleEvent = false;
        }
    },
    {button_group: 'tools'}
);
