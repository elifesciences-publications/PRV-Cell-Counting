//Open dev tools
//require('nw.gui').Window.get().showDevTools();

//Include some dependencies
var fs = require('fs');
var PNG = require('./node-pngjs-master/lib/png').PNG;
var xml = require('./node-xml-master/lib/xml');
//Define some global constants
const MODE_NO_ACTION = 0;
const MODE_SET_BOUNDARIES = 1;
const MODE_SET_VERTICAL_REFERENCE = 2;
const MODE_SET_HORIZONTAL_REFERENCE = 3;
const MODE_DEFINE_CELLS = 4;

//old cell size was 186.
const CELL_SIZE_IN_PIXELS = 120; //This is a rough estimation of how big a circle needs to be to surround a pyramidal cell in our images, at our DPI.
const ORIGIN_SIZE_IN_PIXELS = 1000; //A rough estimation of how big to make the "origin" of each tissue section, at our DPI.

//Instantiate some global variables we will be using
var sections = [];
var data = [[]];
var viewer;
var osd_rgb_plugin;
var overlay;
var mode = MODE_NO_ACTION;

var placing_second_point = false;
var p1 = new OpenSeadragon.Point(0,0);
var p2 = new OpenSeadragon.Point(0,0);

var mppx_string = "openslide.mpp-x";
var mppy_string = "openslide.mpp-y";
var xres_string = "xres";
var yres_string = "yres";
var resolution_unit_string = "resolution-unit";
var width_string = "width";
var height_string = "height";

var mpp_x = 0.23;
var mpp_y = 0.22;
var tif_image_width = 0;
var tif_image_height = 0;
var tif_xres = 0;
var tif_yres = 0;
var tif_res_unit = "in";

var horz_image_coeff = 1;
var vert_image_coeff = 1;
var xml_file_image_width = 1;
var xml_file_image_height = 1;
var xml_file_mppx = 1;
var xml_file_mppy = 1;
var xml_convert_cell_coordinates = false;

//Define a structure to hold data for each tissue section
function Section (vertical_point_1, vertical_point_2, horizontal_point_1, horizontal_point_2, bounds, ap_location, cells)
{
    this.vertical_point_1 = vertical_point_1;
    this.vertical_point_2 = vertical_point_2;
    this.horizontal_point_1 = horizontal_point_1;
    this.horizontal_point_2 = horizontal_point_2;
    this.bounds = bounds;
    this.ap_location = ap_location;
    this.cells = cells;
}

/* MAIN STARTS HERE */
    //Add an event listener to our file dialog
    var chooser = document.querySelector("#fileDialog");
    chooser.addEventListener("change", fileDialogEventListener, false);
    
    var deep_zoom_button = document.querySelector("#fileDialog_visualized");
    deep_zoom_button.addEventListener("click", deepZoomLoadListener, false);

    //Add an event listener to our Z-coordinate text box
    var z_coord_box = document.querySelector("#z_coord");
    z_coord_box.addEventListener("input", handleZCoordChange, false);
    z_coord_box.addEventListener("propertychange", handleZCoordChange, false);
    z_coord_box.addEventListener("paste", handleZCoordChange, false);

    //Add an event listener to our combobox
    var sel = document.querySelector("#section_combobox");
    sel.addEventListener("change", handleSelectionBoxChange, false);

    //Add an event listener to our "add section" button
    var add_section_button = document.querySelector("#add_section");
    add_section_button.addEventListener("click", handleAddTissueSectionClick, false);
    
    //Add an event listener to the "remove cell" button
    var remove_cell_button = document.querySelector("#remove_cell");
    remove_cell_button.addEventListener("click", handleRemoveRecentCell, false);
    
    //Add an event listener to the "save" button
    var save_button = document.querySelector("#save_button");
    save_button.addEventListener("change", handleSaveButton, false);
    
    var save_button_visualized = document.querySelector("#save_button_visualized");
    save_button_visualized.addEventListener("click", handleSaveButtonVisualized, false);
    
    //Add event listeners to the XML loading button
    var xml_loading_input = document.querySelector("#load_cell_counting_xml_invisible_input");
    xml_loading_input.addEventListener("change", handleLoadButton, false);
    
    var xml_loading_visual_button = document.querySelector("#load_cell_counting_xml_button");
    xml_loading_visual_button.addEventListener("click", handleXMLLoadingVisualButtonClick, false);

    //Add an event listener to our radio buttons
    var radios = document.getElementsByName("mode_toggle");
    for (var i = 0; i < radios.length; i++)
    {
        radios[i].addEventListener("click", mode_toggle_click_handler);
    }

    //Create a table which will contain cell coordinates for sections
    var container = document.getElementById('spreadsheet');
    var hot = new Handsontable(container, {
        data: data,
        rowHeaders: true,
        colHeaders: true,
        contextMenu: false,
        readOnly: true,
        stretchH: "all",
        width: 300,
        height: 200,
        colHeaders: ['X', 'Y'],
        minRows: 1,
        minCols: 2
    });
/* MAIN ENDS HERE */

function handleXMLLoadingVisualButtonClick(evt)
{
    var xml_loading_input = document.querySelector("#load_cell_counting_xml_invisible_input");
    xml_loading_input.click();
}

function deepZoomLoadListener(evt)
{
    var chooser = document.querySelector("#fileDialog");
    chooser.click();
}

/* This function causes a click event on the "save" input, which is hidden in the UI (because it is ugly and can't be changed) */
function handleSaveButtonVisualized(evt)
{
    var save_button = document.querySelector("#save_button");
    save_button.click();
}

/* This function handles user input to the Z-coordinate text box. */
function handleZCoordChange(evt)
{
    //If there are sections defined.
    if (sections.length > 0)
    {
        //Get the index of the currently selected section.
        var sel = document.querySelector("#section_combobox");
        var index = sel.selectedIndex;
        
        //Get the z_coordinate text box
        var z_coord_box = document.querySelector("#z_coord");
        
        //Update the model so that the section's z-coordinate matches what the user entered.
        sections[index].ap_location = z_coord_box.value;
    }
}

/* This function is called anytime the user selects a different tissue section. */
function handleSelectionBoxChange(evt)
{
    console.log("in handle selection box function");
    
    //Grab the selection box
    var sel = document.querySelector("#section_combobox");
    
    //Call a specialized function that "selects" the tissue section.
    //This function will update the view based on what is retrieved from the model.
    selectTissueSection(sel.selectedIndex);
}

/* This function is called anytime the user wants to add a new tissue section to the model. */
function handleAddTissueSectionClick(evt)
{
    //Instantiate a new tissue section
    var new_tissue_section = new Section(
        new OpenSeadragon.Point(0, 0),
        new OpenSeadragon.Point(0, 0),
        new OpenSeadragon.Point(0, 0),
        new OpenSeadragon.Point(0, 0),
        new OpenSeadragon.Rect(0, 0, 0, 0),
        0,
        [[]]
    );
    
    //Add the new tissue section to the model.
    //This function will also make sure that the new section is the currently "selected" tissue section,
    //and will thus update the view accordingly.
    addTissueSectionAndSelect(new_tissue_section);
}

/* This function takes a newly created tissue section, "selects" it, and updates the view. */
function addTissueSectionAndSelect ( new_tissue_section )
{
    //Push the new object onto the end of our list of objects.
    sections.push(new_tissue_section);
    var num_sections = sections.length;
    
    //Modify the combo box to include the new section.
    var label = "Section " + num_sections;
    
    var opt = document.createElement("option");
    opt.appendChild(document.createTextNode(label));
    opt.value = label;
    
    var sel = document.querySelector("#section_combobox");
    
    //Make sure the "no sections exist" label is gone
    for (var i = 0; i < sel.length; i++)
    {
        if (sel.options[i].value == "No sections defined")
        {
            sel.remove(i);
        }
    }
    
    //Add the new section to our selection box.
    sel.appendChild(opt); 
    selectTissueSection(num_sections - 1);
}

/* This function retrieves a tissue section from the model and updates the view accordingly. */
function selectTissueSection ( index )
{
    //Change the selection in the combobox itself.
    var sel = document.querySelector("#section_combobox");
    sel.selectedIndex = index;
    
    //Grab the actual section from our data array
    var section = sections[index];
    
    z_coord.value = section.ap_location;
    
    var doesBoundaryExist = (section.bounds.width != 0 && section.bounds.height != 0);
    var doesVerticalReferenceExist = (section.vertical_point_1.x != 0 || section.vertical_point_1.y != 0 ||
        section.vertical_point_2.x != 0 || section.vertical_point_2.y != 0);
    var doesHorizontalReferenceExist = (section.horizontal_point_1.x != 0 || section.horizontal_point_1.y != 0 ||
        section.horizontal_point_2.x != 0 || section.horizontal_point_2.y != 0);
        
    if (doesBoundaryExist)
    {
        hide(document.querySelector("#section_boundary_status_red"));
        show(document.querySelector("#section_boundary_status_green"), 'inline');
    }
    else
    {
        hide(document.querySelector("#section_boundary_status_green"));
        show(document.querySelector("#section_boundary_status_red"), 'inline');
    }
    
    if (doesVerticalReferenceExist)
    {
        hide(document.querySelector("#section_vertical_reference_status_red"));
        show(document.querySelector("#section_vertical_reference_status_green"), 'inline');
    }
    else
    {
        hide(document.querySelector("#section_vertical_reference_status_green"));
        show(document.querySelector("#section_vertical_reference_status_red"), 'inline');
    }
    
    if (doesHorizontalReferenceExist)
    {
        hide(document.querySelector("#section_horizontal_reference_status_red"));
        show(document.querySelector("#section_horizontal_reference_status_green"), 'inline');
    }
    else
    {
        hide(document.querySelector("#section_horizontal_reference_status_green"));
        show(document.querySelector("#section_horizontal_reference_status_red"), 'inline');
    }
    
    //Set the cells table
    data = section.cells;
    hot.updateSettings({
        data: data
        });
    hot.render();
}

/* This function handles a "file open" event for a new DeepZoom image */
function fileDialogEventListener(evt)
{
    //If we have already opened up a sea dragon viewer, delete it.
    var sea_dragon_container = document.querySelector("#openseadragon1");
    if (sea_dragon_container.childElementCount > 0)
    {
        sea_dragon_container.removeChild(sea_dragon_container.firstChild);
    }

    //Output the name of the file that the user wants to open to the console.
    console.log(this.value);
    
    //Parse out the mpp_x and mpp_y properties
    whole_file_path = this.value;
    file_parts = whole_file_path.split(".dzi");
    path_minus_ext = file_parts[0];
    properties_path = path_minus_ext + "_files/vips-properties.xml";
    
    fs.readFile(properties_path, 'utf8', function(err, data) {
        if (err)
        {
            console.log(err);
        }
    
        var mppx_set = 0;
        var mppy_set = 0;
        var tif_width_set = 0;
        var tif_height_set = 0;
        var tif_xres_set = 0;
        var tif_yres_set = 0;
        var tif_res_unit_set = 0;
        
        properties_xml_string = data;
        
        if (window.DOMParser)
        {
            parser = new DOMParser();
            xmlDoc = parser.parseFromString(properties_xml_string, "text/xml");
            
            properties = xmlDoc.getElementsByTagName("property");
            for (var i = 0; i < properties.length; i++)
            {
                if (properties[i].childNodes.length >= 4)
                {
                    prop_name = properties[i].childNodes[1].innerHTML;
                    prop_value = properties[i].childNodes[3].innerHTML;
                    
                    if (prop_name.localeCompare(mppx_string) == 0)
                    {
                        mpp_x = parseFloat(prop_value);
                        console.log(mpp_x);
                        mppx_set = 1;
                    }
                    else if (prop_name.localeCompare(mppy_string) == 0)
                    {
                        mpp_y = parseFloat(prop_value);
                        console.log(mpp_y);
                        mppy_set = 1;
                    }
                }
            }
            
        }
        
        if (!mppx_set && !mppy_set)
        {
            if (!mppx_set)
            {
                console.log("mpp-x property not found.  Using default value.");
            }
            
            if (!mppy_set)
            {
                console.log("mpp-y property not found. Using default value.");
            }
            
            mpp_x = 1.5696;
            mpp_y = 1.5696;
        }
        

    });
    
    
    //Clear the cell data
    data.length = 0;
    hot.render();
    
    //Reset the mode
    var radios = document.getElementsByName("mode_toggle");
    radios[0].checked = true;
    mode = MODE_NO_ACTION;
    
    //Instantiate a new viewer.
    viewer = OpenSeadragon({
        id: "openseadragon1",
        prefixUrl: "./openseadragon/images/",
        tileSources: this.value,
        showFullPageControl: false,
        showZoomControl: false,
        zoomPerClick: 1.0,
        gestureSettingsMouse: {
            clickToZoom: false,
            dblClickToZoom: false
        }
    });
    
    //Instantiate SVG Overlay for OpenSeadragon
    overlay = viewer.svgOverlay();
    
    //Instantiate the RGB plug-in
    osd_rgb_plugin = viewer.rgb();
    
    //Add an event to OpenSeadragon
    OpenSeadragon.addEvent(viewer.element, 'click', handleViewerClicked_Annotations);
    OpenSeadragon.addEvent(viewer.element, 'mousemove', handleMouseMoved_Annotations);
    
    //Add an event handler to handle any clicks on the canvas
    viewer.addHandler('canvas-click', handleCanvasClickEvent);
}

/* This function handles mouse-move events.  These events are currently only important while the user is 
    drawing a "box" around a tissue section to specify the boundaries of that tissue section. */
function handleMouseMoved_Annotations(info)
{
    if (mode == MODE_SET_BOUNDARIES && placing_second_point)
    {
        //console.log(info);
        
        //Convert mouse click coordinate to an image coordinate
        var point = new OpenSeadragon.Point(info.offsetX, info.offsetY);
        var viewportPoint = viewer.viewport.pointFromPixel(point);
        
        p2 = viewportPoint;
        
        updateBoundariesRect();
    }
    else if (mode == MODE_SET_VERTICAL_REFERENCE && placing_second_point)
    {
        //Convert mouse click coordinate to an image coordinate
        var point = new OpenSeadragon.Point(info.offsetX, info.offsetY);
        var viewportPoint = viewer.viewport.pointFromPixel(point);
        
        p2 = viewportPoint;
        
        updateVerticalReferenceLine();
    }
    else if (mode == MODE_SET_HORIZONTAL_REFERENCE && placing_second_point)
    {
        var point = new OpenSeadragon.Point(info.offsetX, info.offsetY);
        var viewportPoint = viewer.viewport.pointFromPixel(point);
        
        p2 = viewportPoint;
        
        updateHorizontalReferenceLine();
    }
}

function updateHorizontalReferenceLine ( )
{
    var sel = document.querySelector("#section_combobox");
    var index = sel.selectedIndex;
    
    //Get the line being drawn
    var line_id = "#horizontal_line" + index.toString();
    var line_overlay = d3.select(overlay.node()).select(line_id);
    
    //Update the line on the screen
    line_overlay.attr("x2", p2.x)
        .attr("y2", p2.y);
}

function updateVerticalReferenceLine ( )
{
    //Get the index of the currently selected section.
    var sel = document.querySelector("#section_combobox");
    var index = sel.selectedIndex;
        
    var line_id = "#vertical_line" + index.toString();

    //Get the line being drawn
    var second_ref_line = d3.select(overlay.node()).select(line_id);
    
    //Update the line on the screen.
    second_ref_line.attr("x2", p2.x)
        .attr("y2", p2.y);
}

/* This function retrieves the current "boundary" being drawn by the user around a tissue section, and updates it
    based on where the user's mouse is. It uses p1 and p2 as the corners for the rectangle. The values of these points
    are set elsewhere by the mouse-move event handler. */
function updateBoundariesRect ( )
{
    //Get the index of the currently selected section.
    var sel = document.querySelector("#section_combobox");
    var index = sel.selectedIndex;
        
    var selection_rect_id = "#selection_rect" + index.toString();

    //Get the rectangle being drawn
    var selection_rect = d3.select(overlay.node()).select(selection_rect_id);
    
    //Figure out our corners
    min_x = Math.min(p1.x, p2.x);
    max_x = Math.max(p1.x, p2.x);
    min_y = Math.min(p1.y, p2.y);
    max_y = Math.max(p1.y, p2.y);
    
    //Update the rectangle on the screen.
    selection_rect.attr("x", min_x)
        .attr("y", min_y)
        .attr("width", max_x - min_x)
        .attr("height", max_y - min_y);
}

/* This function handles click events while the OpenSeadragon viewer has mouse events disabled.
    The purpose of this is primarily to watch for clicks while the user wants to set boundaries
    of tissue sections. */
function handleViewerClicked_Annotations(info)
{
    if (mode == MODE_SET_BOUNDARIES && sections.length > 0)
    {   
        //console.log(info);
        var point = new OpenSeadragon.Point(info.offsetX, info.offsetY);
        
        //Convert mouse click coordinate to an image coordinate
        var viewportPoint = viewer.viewport.pointFromPixel(point);
        var imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint.x, viewportPoint.y);
        
        //Get the index of the currently selected section.
        var sel = document.querySelector("#section_combobox");
        var index = sel.selectedIndex;
        
        var stroke_size = 0.001;
        if (!placing_second_point)
        {
            p1 = viewportPoint;
            
            var selection_rect_id = "selection_rect" + index.toString();
        
            var new_boundaries_overlay = d3.select(overlay.node()).append("rect")
                .style('stroke', 'yellow')
                .style('stroke-width', stroke_size)
                .style('fill-opacity', 0)
                .attr("id", selection_rect_id)
                .attr("x", p1.x)
                .attr("y", p1.y)
                .attr("width", 0)
                .attr("height", 0);
        
            placing_second_point = true;
        }
        else
        {
            //If we have reached this case, it means the user clicked a 2nd time to place the 2nd point of the rectangle.
            
            //Update the rectangle one last time before moving on.
            p2 = viewportPoint;
            updateBoundariesRect();
            
            //Reset the flag
            placing_second_point = false;
            
            //Update the model
            setSectionBoundaries(index, p1, p2);
            
            //Update the view
            updateCurrentlySelectedTissueBoundaries();
        }
    }
}

/* This function updates the boundaries of a tissue section in the model. */
function setSectionBoundaries (section_index, viewport_p1, viewport_p2)
{
    //Convert from viewport to image coordinates, so that we will have the final rectangle in units of pixels.
    p1 = viewer.viewport.viewportToImageCoordinates(viewport_p1);
    p2 = viewer.viewport.viewportToImageCoordinates(viewport_p2);

    //Figure out our corners
    min_x = Math.min(p1.x, p2.x);
    max_x = Math.max(p1.x, p2.x);
    min_y = Math.min(p1.y, p2.y);
    max_y = Math.max(p1.y, p2.y);
    
    var x = Math.floor(min_x);
    var y = Math.floor(min_y);
    var w = Math.floor(max_x - min_x);
    var h = Math.floor(max_y - min_y);
    
    //Update the model
    sections[section_index].bounds.x = x;
    sections[section_index].bounds.y = y;
    sections[section_index].bounds.width = w;
    sections[section_index].bounds.height = h;
}

/* This function updates the boundaries of the currently selected tissue section in the view. */
function updateCurrentlySelectedTissueBoundaries()
{
    //Change the selection in the combobox itself.
    var sel = document.querySelector("#section_combobox");
    var index = sel.selectedIndex;
    
    //Grab the actual section from our data array
    var section = sections[index];

    var boundary_red = document.querySelector("#section_boundary_status_red");
    var boundary_green = document.querySelector("#section_boundary_status_green");
    hide(boundary_red);
    show(boundary_green, 'inline');
}

function beginOrFinishLine ( section, info, isVertical, p1_id, p2_id, line_id )
{
    //Convert the mouse click coordinate to an image coordinate
    var viewportPoint = viewer.viewport.pointFromPixel(info.position);
    var imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint.x, viewportPoint.y);
    
    //Get the content size (the image's size in pixels)
    var max_content_size = Math.max(viewer.viewport.contentSize.x, viewer.viewport.contentSize.y);

    //Calculate the radius and stroke size for each of the end-points on the line being drawn.
    var radius = ((1.0 / mpp_x) * 250) / max_content_size;
    var stroke_size = radius / 10;
    
    if (placing_second_point)
    {
        //If this part of the if-statement is reached, then the user has just "clicked" to place the second point of the reference line.
        //In this code, we will create visuals for the 2nd point when it is placed by the user, and then we will finish the operation of "placing" a reference line.
    
        //Update the position of the 2nd point
        p2 = viewportPoint;
        
        //Check to make sure that an SVG for the 2nd point doesn't already exist
        pre_existing_second_reference = d3.select(overlay.node()).select("#" + p2_id);
        circle_exists = !(pre_existing_second_reference[0][0] == null);
        if (circle_exists)
        {
            d3.select(overlay.node()).select("#" + p2_id).remove();
        }
        
        var p2_fill = 'blue';
        if (!isVertical)
        {
            p2_fill = 'yellow';
        }
        
        //Create a new SVG for the second reference point
        var new_second_ref_overlay = d3.select(overlay.node()).append("circle")
            .style('stroke', p2_fill)
            .style('stroke-width', stroke_size)
            .style('fill-opacity', 0.5)
            .style('fill', p2_fill)
            .attr("id", p2_id)
            .attr("cx", p2.x)
            .attr("cy", p2.y)
            .attr("r", radius);
                        
        //Update the line we created
        pre_existing_line = d3.select(overlay.node()).select("#" + line_id);
        pre_existing_line.attr("x1", p1.x)
            .attr("y1", p1.y)
            .attr("x2", p2.x)
            .attr("y2", p2.y);
                        
        //Create an OpenSeadragon point that we will use for the newly placed point.
        var p2_viewportCoords = new OpenSeadragon.Point(viewportPoint.x, viewportPoint.y);
        var p2_imageCoords = viewer.viewport.viewportToImageCoordinates(p2_viewportCoords);
                    
        //Convert the coordinates of the new point to "section coordinates" (units of pixels with respect to section boundaries)
        var p2_sectionCoords = new OpenSeadragon.Point(
            Math.floor(p2_imageCoords.x) - section.bounds.x, 
            Math.floor(p2_imageCoords.y) - section.bounds.y
            );
            
        //Set the new point in the model
        if (isVertical)
        {
            //If the user is specifying the vertical reference line
            section.vertical_point_2 = p2_sectionCoords;
        }
        else
        {
            //If the user is specifying the horizontal reference line
            section.horizontal_point_2 = p2_sectionCoords;
        }
        
        //Update the view accordingly        
        element_to_hide = "#section_vertical_reference_status_red";
        element_to_show = "#section_vertical_reference_status_green";
        if (!isVertical)
        {
            element_to_hide = "#section_horizontal_reference_status_red";
            element_to_show = "#section_horizontal_reference_status_green";
        }
        hide(document.querySelector(element_to_hide));
        show(document.querySelector(element_to_show), 'inline');
        
        //Set the flag indicating that the 2nd point has now been placed. This means that the definition of the line is finished.
        placing_second_point = false;        
    }
    else
    {
        //If this part of the if-statement is reached, then the user has just "clicked" to place the first point of the reference line.
        
        //Set the working points. At the beginning, the first and second point of the reference line equal each other.
        p1 = viewportPoint;
        p2 = viewportPoint;
        
        var p1_fill = 'green';
        if (!isVertical)
        {
            p1_fill = 'orange';
        }
        
        //Make sure we don't already have a visual created for the first point of the reference line.
        pre_existing_circle = d3.select(overlay.node()).select("#" + p1_id);
        circle_exists = !(pre_existing_circle[0][0] == null);
        if (!circle_exists)
        {
            //If there is no pre-existing visual of the first reference point, let's create one.
            //Create a graphical overlay on the canvas.
            var new_p1_overlay = d3.select(overlay.node()).append("circle")
                .style('stroke', p1_fill)
                .style('stroke-width', stroke_size)
                .style('fill-opacity', 0.5)
                .style('fill', p1_fill)
                .attr("id", p1_id)
                .attr("cx", p1.x)
                .attr("cy", p1.y)
                .attr("r", radius);
                
            //We also need to create the visual for a line.
            var new_line_overlay = d3.select(overlay.node()).append("line")
                .style('stroke', 'rgb(255,0,255)')
                .style('stroke-width', stroke_size)
                .attr("x1", p1.x)
                .attr("y1", p1.y)
                .attr("x2", p2.x)
                .attr("y2", p2.y)
                .attr("id", line_id);
        }
        else
        {
            //If this portion of the if-statement is reached, it means that the user has previously defined a reference line
            //of this type for this section.  Therefore, the user is redefining the reference line.  
            //At this point, we need to find the original graphical overlay, and place it at the new position that the user
            //has defined.
            
            //Move the existing graphical overlay to a new position.
            pre_existing_circle.attr("cx", p1.x)
                .attr("cy", p1.y);
                
            //Update the line accordingly
            pre_existing_line = d3.select(overlay.node()).select("#" + line_id);
            pre_existing_line.attr("x1", p1.x)
                .attr("y1", p1.y)
                .attr("x2", p2.x)
                .attr("y2", p2.y);
            
            //Remove the overlay for the second reference point if it exists
            pre_existing_second_reference = d3.select(overlay.node()).select("#" + p2_id);
            d3.select(overlay.node()).select("#" + p2_id).remove();
        }
                    
        //Now let's create an OpenSeadragon point that we will use to store the new point in the model.
        var p1_viewportCoords = new OpenSeadragon.Point(viewportPoint.x, viewportPoint.y);
        var p1_imageCoords = viewer.viewport.viewportToImageCoordinates(p1_viewportCoords);
                    
        //Convert the point's coordinates to "section coordinates" (in pixels with respect to section boundaries)
        var p1_sectionCoords = new OpenSeadragon.Point(
            Math.floor(p1_imageCoords.x) - section.bounds.x, 
            Math.floor(p1_imageCoords.y) - section.bounds.y
            );
                    
        //Set the origin of the tissue section in the model.
        if (isVertical)
        {
            section.vertical_point_1 = p1_sectionCoords;
        }
        else
        {
            section.horizontal_point_1 = p1_sectionCoords;
        }
        
        //Set the flag to place the next point
        placing_second_point = true;    
    }

}

/* This function handles any clicks that occur on the DeepZoom canvas */
function handleCanvasClickEvent(info)
{
    //Convert the mouse click coordinate to an image coordinate
    var viewportPoint = viewer.viewport.pointFromPixel(info.position);
    var imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint.x, viewportPoint.y);
    
    var max_content_size = Math.max(viewer.viewport.contentSize.x, viewer.viewport.contentSize.y);
    
    //If it was a click event (not a drag event)
    //AND if the user has defined some brain sections.
    if (info.quick && sections.length > 0)
    {
        //Display the image coordinate in the log
        //console.log(imagePoint.x, imagePoint.y);
        console.log(viewportPoint.x, viewportPoint.y);
        
        //Get the currently selected brain section
        var sel = document.querySelector("#section_combobox");
        var index = sel.selectedIndex;
        
        //Get the current tissue section.
        var section = sections[index];
        
        //Select a behavior depending on what mode the program is in.
        switch (mode)
        {
            case MODE_SET_HORIZONTAL_REFERENCE:
                
                //Create an id for the origin circle
                var p1_id = "horizontal_point_1_circle" + index.toString();
                var line_id = "horizontal_line" + index.toString();
                var p2_id = "horizontal_point_2_circle" + index.toString();
                
                beginOrFinishLine ( section, info, 0, p1_id, p2_id, line_id );
                
                break;
            case MODE_SET_VERTICAL_REFERENCE:
                
                //Create an id for the origin circle
                var p1_id = "vertical_point_1_circle" + index.toString();
                var line_id = "vertical_line" + index.toString();
                var p2_id = "vertical_point_2_circle" + index.toString();
        
                beginOrFinishLine ( section, info, 1, p1_id, p2_id, line_id );
                
                break;
            case MODE_DEFINE_CELLS:
                //In this case, the user would like to define the location of a cell in the tissue section.
                //Add the cell to our list of cells.
                
                var imageX = Math.floor(imagePoint.x);
                var imageY = Math.floor(imagePoint.y);
                
                var cellX_withRespectToOrigin_pixelUnits = (imageX - section.bounds.x) - section.vertical_point_1.x;
                var cellY_withRespectToOrigin_pixelUnits = (imageY - section.bounds.y) - section.vertical_point_1.y;
                
                var cellX_mmUnits = Math.round(cellX_withRespectToOrigin_pixelUnits * mpp_x) / 1000;
                var cellY_mmUnits = Math.round(cellY_withRespectToOrigin_pixelUnits * mpp_y) / 1000;
                
                //Define a cell id
                var cell_id = "section" + index.toString() + "_cell_x" + (cellX_mmUnits * 1000).toString() + "_cell_y" + 
                    (cellY_mmUnits * 1000).toString();
                console.log(cell_id);
                
                //Add the new "cell" to our list of cells.  The "unshift" function is basically a "add to beginning of array" function.
                data.unshift([cellX_mmUnits, cellY_mmUnits]);
                
                //Update the model to make sure we have stored all cells.
                section.cells = data;
                
                //Update the view by rendering the spreadsheet.
                hot.render();
                
                //Create a graphical overlay on the canvas.
                var radius = CELL_SIZE_IN_PIXELS / max_content_size;
                var stroke_size = radius / 10;
                
                var new_cell_overlay = d3.select(overlay.node()).append("circle")
                    .style('stroke', 'red')
                    .style('stroke-width', stroke_size)
                    .style('fill-opacity', 0)
                    .attr("cx", viewportPoint.x)
                    .attr("cy", viewportPoint.y)
                    .attr("r", radius)
                    .attr("id", cell_id);
                    
                break;
            default:
                break;
        }
    }
}

/* This function handles a click on the "remove cell" button. It removes the most recent cell
of the currently selected tissue section. */
function handleRemoveRecentCell ()
{
    //Get the currently selected brain section
    var sel = document.querySelector("#section_combobox");
    var index = sel.selectedIndex;
    
    //Get the current tissue section.
    var section = sections[index];
    
    //Get the most recent cell
    recent_cell = data[0];
    cell_x = recent_cell[0];
    cell_y = recent_cell[1];
    
    //Make sure the cell actually exists
    if (cell_x != null && cell_y != null)
    {
        //Define a cell id
        var cell_id = "section" + index.toString() + "_cell_x" + (cell_x * 1000).toString() + "_cell_y" + (cell_y * 1000).toString();
        console.log(cell_id);
    
        //If the cell exists, then delete it
        data.shift();
        
        //Update the model
        section.cells = data;
        
        //Update the view - the table
        hot.render();
        
        //Update the view - remove the circle on the canvas
        d3.select(overlay.node()).select("#" + cell_id).remove();
    }
}

/* This function handles changes to our radio buttons.  The radio buttons primarily determine what "mode" the program is in. */
function mode_toggle_click_handler()
{
    var radios = document.getElementsByName("mode_toggle");
    for (var i = 0; i < radios.length; i++)
    {
        if (radios[i].checked)
        {
            mode = i;
            placing_second_point = false;
            console.log("Mode change to " + i);
            
            //If the mode has just been set to "MODE_SET_BOUNDARIES", disable mouse navigation of the canvas
            if (mode == MODE_SET_BOUNDARIES)
            {
                viewer.setMouseNavEnabled(false);
            }
            else
            {
                viewer.setMouseNavEnabled(true);
            }
        }
    }
}

/* This function handles clicks to the save button. */
function handleSaveButton ( )
{
    console.log('in save function');
    
    var file_name = this.value;
    
    var all_sections = {sections: []};
    
    for (var s_index = 0; s_index < sections.length; s_index++)
    {
        var cur_section = sections[s_index];
        
        var all_cells = {cells: []};
        for (var c = 0; c < cur_section.cells.length; c++)
        {
            var this_cell_x = {x:cur_section.cells[c][0]};
            var this_cell_y = {y:cur_section.cells[c][1]};
            var this_cell = {cell: [this_cell_x, this_cell_y]};
            all_cells.cells.push(this_cell);
        }
        
        var section_bounds = {bounds: [{x: cur_section.bounds.x}, 
            {y: cur_section.bounds.y},
            {width: cur_section.bounds.width},
            {height: cur_section.bounds.height}]};
            
        var section_vertical_point_1 = {vertical_point_1: [{x: cur_section.vertical_point_1.x},
            {y: cur_section.vertical_point_1.y}]};
        var section_vertical_point_2 = {vertical_point_2: [{x: cur_section.vertical_point_2.x},
            {y: cur_section.vertical_point_2.y}]};
            
        var section_horizontal_point_1 = {horizontal_point_1: [{x: cur_section.horizontal_point_1.x},
            {y: cur_section.horizontal_point_1.y}]};
        var section_horizontal_point_2 = {horizontal_point_2: [{x: cur_section.horizontal_point_2.x},
            {y: cur_section.horizontal_point_2.y}]};            
            
        var ap_location = {ap_location: cur_section.ap_location};
        
        var this_section = {section: [{ _attr: { index: s_index } }]};
        this_section.section.push(all_cells);
        this_section.section.push(section_bounds);
        this_section.section.push(section_vertical_point_1);
        this_section.section.push(section_vertical_point_2);
        this_section.section.push(section_horizontal_point_1);
        this_section.section.push(section_horizontal_point_2);
        this_section.section.push(ap_location);
        
        all_sections.sections.push(this_section);
    }
    
    var slide_size = viewer.viewport.contentSize;
    
    var slide = { slide: [{ _attr: { version: 2.0, mpp_x: mpp_x, mpp_y: mpp_y, 
        image_width: slide_size.x, image_height: slide_size.y }}, all_sections]};
    
    var xml_string = xml(slide, { indent: '    ' });
    
    if (!endsWith(file_name, '.xml'))
    {
        file_name = file_name + '.xml';
    }
    
    fs.writeFile(file_name, xml_string, function(err) {
        if (err)
        {
            console.log(err);
        }
        
        console.log("The file was saved!");
    });
}

function handleLoadButton ( )
{
    //Get the file name from the HTML input element
    var file_name = this.value;
    
    //Load the file
    var xml_text = fs.readFileSync(file_name, 'utf8');
    
    //Convert the string into an XML document tree
    var parser = new DOMParser();
    var xml_doc = parser.parseFromString(xml_text, "text/xml");
    
    //Find the base "slide" tag, and see what the saved file version is
    var slide = xml_doc.getElementsByTagName("slide")[0];
    var version_string = slide.getAttribute("version");
    var version_number = parseInt(version_string);
    var mpp_x_new = parseFloat(slide.getAttribute("mpp_x"));
    var mpp_y_new = parseFloat(slide.getAttribute("mpp_y"));
    var image_width_new = parseFloat(slide.getAttribute("image_width"));
    var image_height_new = parseFloat(slide.getAttribute("image_height"));
    
    var slide_size = viewer.viewport.contentSize;
    if (image_width_new != slide_size.x && image_height_new != slide_size.y && mpp_x_new != mpp_x && mpp_y_new != mpp_y)
    {
        horz_image_coeff = slide_size.x / image_width_new;
        vert_image_coeff = slide_size.y / image_height_new;
        
        xml_file_image_width = image_width_new;
        xml_file_image_height = image_height_new;
        xml_file_mppx = mpp_x_new;
        xml_file_mppy = mpp_y_new;
        xml_convert_cell_coordinates = true;
    }
    
    //Parse the XML based on the correct file version
    if (version_number == 1)
    {
        loadSavedXMLVersion1(xml_doc);
    }
    else if (version_number == 2)
    {
        loadSavedXMLVersion2(xml_doc);
    }
    
    //Define some UI constants
    var max_content_size = Math.max(viewer.viewport.contentSize.x, viewer.viewport.contentSize.y);
    var border_stroke_size = 0.001;
    var reference_point_radius = ((1.0 / mpp_x) * 250) / max_content_size;
    var reference_point_stroke_size = reference_point_radius / 10;
    var cell_radius = CELL_SIZE_IN_PIXELS / max_content_size;
    var cell_stroke_size = cell_radius / 10;
    
    //Get the UI's tissue-section drop-down box
    var sel = document.querySelector("#section_combobox");
    
    //Make sure the "no sections exist" label is gone
    for (var i = 0; i < sel.length; i++)
    {
        if (sel.options[i].value == "No sections defined")
        {
            sel.remove(i);
        }
    }
    
    //Create UI for each section
    for (var s = 0; s < sections.length; s++)
    {
        createUIForSection ( sections[s], s, border_stroke_size, reference_point_stroke_size, cell_stroke_size, reference_point_radius, cell_radius );
        
        //Add the tissue sections to the drop-down box, and select the first tissue section
        var label = "Section " + (s + 1);
        var opt = document.createElement("option");
        opt.appendChild(document.createTextNode(label));
        opt.value = label;    
        
        //Add the new section to our selection box.
        sel.appendChild(opt); 
    }
    
    //Select the first tissue section
    selectTissueSection(0);
}

function loadSavedXMLVersion1 ( xml_doc )
{
    //Clear all sections from the list of sections
    sections = [];

    //Retrieve all sections in the file
    var xml_sections = xml_doc.getElementsByTagName("section");
    
    //Iterate over each section, and create it in memory
    for (var x = 0; x < xml_sections.length; x++)
    {
        var this_section = xml_sections[x];
        
        //Grab each type of item from the xml doc
        var bounds_xml = this_section.getElementsByTagName("bounds")[0];
        var origin_xml = this_section.getElementsByTagName("origin")[0];
        var second_reference_xml = this_section.getElementsByTagName("second_reference")[0];
        var all_cells_xml = this_section.getElementsByTagName("cell");
        
        //Parse the bounds
        var bounds_x = parseInt(bounds_xml.getElementsByTagName("x")[0].innerHTML) * horz_image_coeff;
        var bounds_y = parseInt(bounds_xml.getElementsByTagName("y")[0].innerHTML) * vert_image_coeff;
        var bounds_width = parseInt(bounds_xml.getElementsByTagName("width")[0].innerHTML) * horz_image_coeff;
        var bounds_height = parseInt(bounds_xml.getElementsByTagName("height")[0].innerHTML) * vert_image_coeff;
        
        //Parse the origin point
        var origin_x = parseInt(origin_xml.getElementsByTagName("x")[0].innerHTML) * horz_image_coeff;
        var origin_y = parseInt(origin_xml.getElementsByTagName("y")[0].innerHTML) * vert_image_coeff;
        
        //Parse the second reference point
        var sr_x = parseInt(second_reference_xml.getElementsByTagName("x")[0].innerHTML) * horz_image_coeff;
        var sr_y = parseInt(second_reference_xml.getElementsByTagName("y")[0].innerHTML) * vert_image_coeff;
        
        //Parse the cells
        this_section_cells = [];
        for (var y = 0; y < all_cells_xml.length; y++)
        {
            var this_cell = all_cells_xml[y];
            var cell_x = parseFloat(this_cell.getElementsByTagName("x")[0].innerHTML);
            var cell_y = parseFloat(this_cell.getElementsByTagName("y")[0].innerHTML);
            
            //Check to see if cell coordinates loaded from the XML file need to be converted to the new image space.
            if (xml_convert_cell_coordinates)
            {                
                var x_in_microns = cell_x * 1000;
                var y_in_microns = cell_y * 1000;
                
                var x_in_pixels = x_in_microns / xml_file_mppx;
                var y_in_pixels = y_in_microns / xml_file_mppy;
                
                var x_image_pixels = x_in_pixels + parseInt(origin_xml.getElementsByTagName("x")[0].innerHTML) + 
                    parseInt(bounds_xml.getElementsByTagName("x")[0].innerHTML);
                var y_image_pixels = y_in_pixels + parseInt(origin_xml.getElementsByTagName("y")[0].innerHTML) + 
                    parseInt(bounds_xml.getElementsByTagName("y")[0].innerHTML);
                    
                var converted_pixels_x = x_image_pixels * horz_image_coeff;
                var converted_pixels_y = y_image_pixels * vert_image_coeff;
                
                var converted_x_in_pixels = converted_pixels_x - bounds_x - origin_x;
                var converted_y_in_pixels = converted_pixels_y - bounds_y - origin_y;
                
                var converted_x_in_microns = converted_x_in_pixels * mpp_x;
                var converted_y_in_microns = converted_y_in_pixels * mpp_y;
                
                cell_x = converted_x_in_microns / 1000;
                cell_y = converted_y_in_microns / 1000;
            }
            
            //Save the cell
            this_section_cells.push([cell_x, cell_y]);
        }
        
        //Get the AP location
        var ap_location_xml = this_section.getElementsByTagName("ap_location");
        var ap_location_int = parseInt(ap_location_xml.innerHTML);
        
        //Now create a new section
        var new_tissue_section = new Section(
            new OpenSeadragon.Point(origin_x, origin_y),
            new OpenSeadragon.Point(sr_x, sr_y),
            new OpenSeadragon.Point(0, 0),
            new OpenSeadragon.Point(0, 0),
            new OpenSeadragon.Rect(bounds_x, bounds_y, bounds_width, bounds_height),
            ap_location_int,
            this_section_cells
        );
        
        //Add the new tissue section to our list of sections.
        sections.push(new_tissue_section);
    }
}

function loadSavedXMLVersion2 ( xml_doc )
{
    //Clear all sections from the list of sections
    sections = [];

    //Retrieve all sections in the file
    var xml_sections = xml_doc.getElementsByTagName("section");
    
    //Iterate over each section, and create it in memory
    for (var x = 0; x < xml_sections.length; x++)
    {
        var this_section = xml_sections[x];
        
        //Grab each type of item from the xml doc
        var bounds_xml = this_section.getElementsByTagName("bounds")[0];
        var vp1 = this_section.getElementsByTagName("vertical_point_1")[0];
        var vp2 = this_section.getElementsByTagName("vertical_point_2")[0];
        var hp1 = this_section.getElementsByTagName("horizontal_point_1")[0];
        var hp2 = this_section.getElementsByTagName("horizontal_point_2")[0];
        var all_cells_xml = this_section.getElementsByTagName("cell");
        
        //Parse the bounds
        var bounds_x = parseInt(bounds_xml.getElementsByTagName("x")[0].innerHTML) * horz_image_coeff;
        var bounds_y = parseInt(bounds_xml.getElementsByTagName("y")[0].innerHTML) * vert_image_coeff;
        var bounds_width = parseInt(bounds_xml.getElementsByTagName("width")[0].innerHTML) * horz_image_coeff;
        var bounds_height = parseInt(bounds_xml.getElementsByTagName("height")[0].innerHTML) * vert_image_coeff;
        
        //Parse the origin point
        var vp1x = parseInt(vp1.getElementsByTagName("x")[0].innerHTML) * horz_image_coeff;
        var vp1y = parseInt(vp1.getElementsByTagName("y")[0].innerHTML) * vert_image_coeff;
        
        //Parse the second reference point
        var vp2x = parseInt(vp2.getElementsByTagName("x")[0].innerHTML) * horz_image_coeff;
        var vp2y = parseInt(vp2.getElementsByTagName("y")[0].innerHTML) * vert_image_coeff;
        
        //Parse the second reference point
        var hp1x = parseInt(hp1.getElementsByTagName("x")[0].innerHTML) * horz_image_coeff;
        var hp1y = parseInt(hp1.getElementsByTagName("y")[0].innerHTML) * vert_image_coeff;
        
        //Parse the second reference point
        var hp2x = parseInt(hp2.getElementsByTagName("x")[0].innerHTML) * horz_image_coeff;
        var hp2y = parseInt(hp2.getElementsByTagName("y")[0].innerHTML) * vert_image_coeff;
        
        //Parse the cells
        this_section_cells = [];
        for (var y = 0; y < all_cells_xml.length; y++)
        {
            var this_cell = all_cells_xml[y];
            var cell_x = parseFloat(this_cell.getElementsByTagName("x")[0].innerHTML);
            var cell_y = parseFloat(this_cell.getElementsByTagName("y")[0].innerHTML);
            
            //Check to see if cell coordinates loaded from the XML file need to be converted to the new image space.
            if (xml_convert_cell_coordinates)
            {                
                var x_in_microns = cell_x * 1000;
                var y_in_microns = cell_y * 1000;
                
                var x_in_pixels = x_in_microns / xml_file_mppx;
                var y_in_pixels = y_in_microns / xml_file_mppy;
                
                var x_image_pixels = x_in_pixels + parseInt(vp1.getElementsByTagName("x")[0].innerHTML) + 
                    parseInt(bounds_xml.getElementsByTagName("x")[0].innerHTML);
                var y_image_pixels = y_in_pixels + parseInt(vp1.getElementsByTagName("y")[0].innerHTML) + 
                    parseInt(bounds_xml.getElementsByTagName("y")[0].innerHTML);
                    
                var converted_pixels_x = x_image_pixels * horz_image_coeff;
                var converted_pixels_y = y_image_pixels * vert_image_coeff;
                
                var converted_x_in_pixels = converted_pixels_x - bounds_x - origin_x;
                var converted_y_in_pixels = converted_pixels_y - bounds_y - origin_y;
                
                var converted_x_in_microns = converted_x_in_pixels * mpp_x;
                var converted_y_in_microns = converted_y_in_pixels * mpp_y;
                
                cell_x = converted_x_in_microns / 1000;
                cell_y = converted_y_in_microns / 1000;
            }
            
            this_section_cells.push([cell_x, cell_y]);
        }
        
        //Get the AP location
        var ap_location_xml = this_section.getElementsByTagName("ap_location");
        var ap_location_int = parseInt(ap_location_xml.innerHTML);
        
        //Now create a new section
        var new_tissue_section = new Section(
            new OpenSeadragon.Point(vp1x, vp1y),
            new OpenSeadragon.Point(vp2x, vp2y),
            new OpenSeadragon.Point(hp1x, hp1y),
            new OpenSeadragon.Point(hp2x, hp2y),
            new OpenSeadragon.Rect(bounds_x, bounds_y, bounds_width, bounds_height),
            ap_location_int,
            this_section_cells
        );
        
        //Add the new tissue section to our list of sections.
        sections.push(new_tissue_section);
    }
}

function createUIForSection ( section, section_number, border_stroke_size, reference_point_stroke_size, cell_stroke_size, reference_point_radius, cell_radius )
{
    //Create the boundary rect for this section
    var bounds = section.bounds;
    var p1im = new OpenSeadragon.Point(bounds.x, bounds.y);
    var p2im = new OpenSeadragon.Point(bounds.x + bounds.width, bounds.y + bounds.height);
    var p1 = viewer.viewport.imageToViewportCoordinates(p1im.x, p1im.y);
    var p2 = viewer.viewport.imageToViewportCoordinates(p2im.x, p2im.y);
    
    var new_selection_rect_id = "selection_rect" + section_number.toString();
    var new_boundaries_overlay = d3.select(overlay.node()).append("rect")
                .style('stroke', 'yellow')
                .style('stroke-width', border_stroke_size)
                .style('fill-opacity', 0)
                .attr("id", new_selection_rect_id)
                .attr("x", p1.x)
                .attr("y", p1.y)
                .attr("width", p2.x - p1.x)
                .attr("height", p2.y - p1.y);
                
    //Create the vertical reference line
    var p1_fill = 'green';
    var p2_fill = 'blue';
    var p1_id = 'vertical_point_1_circle' + section_number.toString();
    var p2_id = 'vertical_point_2_circle' + section_number.toString();
    var line_id = 'vertical_line' + section_number.toString();
        
    var vrp1 = section.vertical_point_1;
    var vrp2 = section.vertical_point_2;
    p1 = viewer.viewport.imageToViewportCoordinates(bounds.x + vrp1.x, bounds.y + vrp1.y);
    p2 = viewer.viewport.imageToViewportCoordinates(bounds.x + vrp2.x, bounds.y + vrp2.y);
        
    //Circle for the first line
    d3.select(overlay.node()).append("circle")
        .style('stroke', p1_fill)
        .style('stroke-width', reference_point_stroke_size)
        .style('fill-opacity', 0.5)
        .style('fill', p1_fill)
        .attr("id", p1_id)
        .attr("cx", p1.x)
        .attr("cy", p1.y)
        .attr("r", reference_point_radius);
    
    d3.select(overlay.node()).append("circle")
        .style('stroke', p2_fill)
        .style('stroke-width', reference_point_stroke_size)
        .style('fill-opacity', 0.5)
        .style('fill', p2_fill)
        .attr("id", p2_id)
        .attr("cx", p2.x)
        .attr("cy", p2.y)
        .attr("r", reference_point_radius);
                        
    //Create the line
    d3.select(overlay.node()).append("line")
        .style('stroke', 'rgb(255,0,255)')
        .style('stroke-width', reference_point_stroke_size)
        .attr("x1", p1.x)
        .attr("y1", p1.y)
        .attr("x2", p2.x)
        .attr("y2", p2.y)
        .attr("id", line_id);
        
    //Now draw the horizontal reference line
    p1_fill = 'orange';
    p2_fill = 'yellow';
    p1_id = 'horizontal_point_1_circle' + section_number.toString();
    p2_id = 'horizontal_point_2_circle' + section_number.toString();
    line_id = 'horizontal_line' + section_number.toString();
        
    var hrp1 = section.horizontal_point_1;
    var hrp2 = section.horizontal_point_2;
    p1 = viewer.viewport.imageToViewportCoordinates(bounds.x + hrp1.x, bounds.y + hrp1.y);
    p2 = viewer.viewport.imageToViewportCoordinates(bounds.x + hrp2.x, bounds.y + hrp2.y);
        
    //Circle for the first line
    d3.select(overlay.node()).append("circle")
        .style('stroke', p1_fill)
        .style('stroke-width', reference_point_stroke_size)
        .style('fill-opacity', 0.5)
        .style('fill', p1_fill)
        .attr("id", p1_id)
        .attr("cx", p1.x)
        .attr("cy", p1.y)
        .attr("r", reference_point_radius);
    
    d3.select(overlay.node()).append("circle")
        .style('stroke', p2_fill)
        .style('stroke-width', reference_point_stroke_size)
        .style('fill-opacity', 0.5)
        .style('fill', p2_fill)
        .attr("id", p2_id)
        .attr("cx", p2.x)
        .attr("cy", p2.y)
        .attr("r", reference_point_radius);
                        
    //Create the line
    d3.select(overlay.node()).append("line")
        .style('stroke', 'rgb(255,0,255)')
        .style('stroke-width', reference_point_stroke_size)
        .attr("x1", p1.x)
        .attr("y1", p1.y)
        .attr("x2", p2.x)
        .attr("y2", p2.y)
        .attr("id", line_id);
        
        
    //Now we need to draw a circle for each cell.
    for (var c = 0; c < section.cells.length; c++)
    {
        var this_cell_x = section.cells[c][0];
        var this_cell_y = section.cells[c][1];
        
        var x_in_microns = this_cell_x * 1000;
        var y_in_microns = this_cell_y * 1000;
        
        var x_in_pixels = x_in_microns / mpp_x;
        var y_in_pixels = y_in_microns / mpp_y;
        
        var x_image_pixels = x_in_pixels + section.vertical_point_1.x + section.bounds.x;
        var y_image_pixels = y_in_pixels + section.vertical_point_1.y + section.bounds.y;
        
        var cell_id = "section" + section_number.toString() + "_cell_x" + x_in_microns.toString() + "_cell_y" + 
                    y_in_microns.toString();
        
        var cell_viewport_point = viewer.viewport.imageToViewportCoordinates(x_image_pixels, y_image_pixels);
        d3.select(overlay.node()).append("circle")
            .style('stroke', 'red')
            .style('stroke-width', cell_stroke_size)
            .style('fill-opacity', 0)
            .attr("cx", cell_viewport_point.x)
            .attr("cy", cell_viewport_point.y)
            .attr("r", cell_radius)
            .attr("id", cell_id);
    }
}

//Helper function to see if a string ends with a certain suffix
function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

//Helper function to hide UI elements
function hide (elements) {
  elements = elements.length ? elements : [elements];
  for (var index = 0; index < elements.length; index++) {
    elements[index].style.display = 'none';
  }
}

//Helper function to show UI elements
function show (elements, specifiedDisplay) {
  elements = elements.length ? elements : [elements];
  for (var index = 0; index < elements.length; index++) {
    elements[index].style.display = specifiedDisplay || 'block';
  }
}










