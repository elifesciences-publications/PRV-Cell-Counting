function slide = ReadPRVDataFile ( )

    convert_to_latest = 1;

    [file path] = uigetfile ('*.xml');
    data = parseXML([path file]);
    
    slide = struct('sections', [], 'mpp_x', 0, 'mpp_y', 0, 'image_width', 0, 'image_height', 0, 'version', 0);
    for i=1:length(data.Attributes)
        slide.(data.Attributes(i).Name) = str2num(data.Attributes(i).Value);
    end
    
    if (slide.version == 1)
        sections = ReadPRVDataFileV1 ( data, convert_to_latest );
    else
        sections = ReadPRVDataFileV2 ( data );
    end
    
    slide.sections = sections;
end

function sections = ReadPRVDataFileV1 ( data, convert_to_latest )

    sections = [];
    
    sections_child_index = find(strcmpi({data.Children.Name}, 'sections'));
    sections_indices = find(strcmpi({data.Children(sections_child_index).Children.Name}, 'section'));
    for i=1:length(sections_indices)
        section_xml = data.Children(sections_child_index).Children(sections_indices(i));
        
        if (convert_to_latest)
            section = struct('index', 0, 'bounds', [], 'vertical_point_1', [], 'vertical_point_2', [], ...
                'horizontal_point_1', [], 'horizontal_point_2', [], 'ap_location', 0, 'cells', []);
        else
            section = struct('index', 0, 'bounds', [], 'origin', [], 'second_reference', [], 'ap_location', 0, 'cells', []);
        end
        
        %Parse out the section index
        section.index = str2num(section_xml.Attributes(1).Value);
        
        %Parse out the bounds of the section
        bounds_index = find(strcmpi({section_xml.Children.Name}, 'bounds'));
        bounds_xml = section_xml.Children(bounds_index);
        x_xml_index = find(strcmpi({bounds_xml.Children.Name}, 'x'));
        y_xml_index = find(strcmpi({bounds_xml.Children.Name}, 'y'));
        width_xml_index = find(strcmpi({bounds_xml.Children.Name}, 'width'));
        height_xml_index = find(strcmpi({bounds_xml.Children.Name}, 'height'));
        x_xml = bounds_xml.Children(x_xml_index);
        y_xml = bounds_xml.Children(y_xml_index);
        width_xml = bounds_xml.Children(width_xml_index);
        height_xml = bounds_xml.Children(height_xml_index);
        
        x = str2double(x_xml.Children(1).Data);
        y = str2double(y_xml.Children(1).Data);
        width = str2double(width_xml.Children(1).Data);
        height = str2double(height_xml.Children(1).Data);
        
        section.bounds = [x y width height];
        
        %Parse out the origin of the section
        origin_index = find(strcmpi({section_xml.Children.Name}, 'origin'));
        origin_xml = section_xml.Children(origin_index);
        x_xml_index = find(strcmpi({origin_xml.Children.Name}, 'x'));
        y_xml_index = find(strcmpi({origin_xml.Children.Name}, 'y'));
        x_xml = origin_xml.Children(x_xml_index);
        y_xml = origin_xml.Children(y_xml_index);
        x = str2double(x_xml.Children(1).Data);
        y = str2double(y_xml.Children(1).Data);
        
        if (convert_to_latest)
            section.vertical_point_1 = [x y];
        else
            section.origin = [x y];
        end
        
        %Parse out the second reference of the section
        sr_index = find(strcmpi({section_xml.Children.Name}, 'second_reference'));
        sr_xml = section_xml.Children(sr_index);
        x_xml_index = find(strcmpi({sr_xml.Children.Name}, 'x'));
        y_xml_index = find(strcmpi({sr_xml.Children.Name}, 'y'));
        x_xml = sr_xml.Children(x_xml_index);
        y_xml = sr_xml.Children(y_xml_index);
        x = str2double(x_xml.Children(1).Data);
        y = str2double(y_xml.Children(1).Data);
        
        if (convert_to_latest)
            section.vertical_point_2 = [x y];
        else
            section.second_reference = [x y];
        end
        
        if (convert_to_latest)
            section.horizontal_point_1 = [NaN NaN];
            section.horizontal_point_2 = [NaN NaN];
        end
        
        %Parse out the ap location
        ap_location_index = find(strcmpi({section_xml.Children.Name}, 'ap_location'));
        ap_location_xml = section_xml.Children(ap_location_index);
        
        section.ap_location = str2double(ap_location_xml.Children(1).Data);
        
        %Parse out all of the cells
        cells = [];
        
        cells_index = find(strcmpi({section_xml.Children.Name}, 'cells'));
        cells_xml = section_xml.Children(cells_index);
        cell_indices = find(strcmpi({cells_xml.Children.Name}, 'cell'));
        for i = 1:length(cell_indices)
            %Iterate through cells
            
            %Get the current cell
            cell_xml = cells_xml.Children(cell_indices(i));
            
            %Parse out the x/y coordinates of the cell
            x_xml_index = find(strcmpi({cell_xml.Children.Name}, 'x'));
            y_xml_index = find(strcmpi({cell_xml.Children.Name}, 'y'));
            x_xml = cell_xml.Children(x_xml_index);
            y_xml = cell_xml.Children(y_xml_index);
            
            bad_cell = isempty(x_xml.Children) || isempty(y_xml.Children);
            if (~bad_cell)
                x = str2double(x_xml.Children(1).Data);
                y = str2double(y_xml.Children(1).Data);

                cells = [cells; x y];
            end
        end
        
        section.cells = cells;
        sections = [sections section];
    end

end

function sections = ReadPRVDataFileV2 ( data )

    sections = [];
    
    sections_child_index = find(strcmpi({data.Children.Name}, 'sections'));
    sections_indices = find(strcmpi({data.Children(sections_child_index).Children.Name}, 'section'));
    for i=1:length(sections_indices)
        section_xml = data.Children(sections_child_index).Children(sections_indices(i));
        
        section = struct('index', 0, 'bounds', [], 'vertical_point_1', [], 'vertical_point_2', [], ...
            'horizontal_point_1', [], 'horizontal_point_2', [], 'ap_location', 0, 'cells', []);
        
        %Parse out the section index
        section.index = str2num(section_xml.Attributes(1).Value);
        
        %Parse out the bounds of the section
        bounds_index = find(strcmpi({section_xml.Children.Name}, 'bounds'));
        bounds_xml = section_xml.Children(bounds_index);
        x_xml_index = find(strcmpi({bounds_xml.Children.Name}, 'x'));
        y_xml_index = find(strcmpi({bounds_xml.Children.Name}, 'y'));
        width_xml_index = find(strcmpi({bounds_xml.Children.Name}, 'width'));
        height_xml_index = find(strcmpi({bounds_xml.Children.Name}, 'height'));
        x_xml = bounds_xml.Children(x_xml_index);
        y_xml = bounds_xml.Children(y_xml_index);
        width_xml = bounds_xml.Children(width_xml_index);
        height_xml = bounds_xml.Children(height_xml_index);
        
        x = str2double(x_xml.Children(1).Data);
        y = str2double(y_xml.Children(1).Data);
        width = str2double(width_xml.Children(1).Data);
        height = str2double(height_xml.Children(1).Data);
        
        section.bounds = [x y width height];
        
        %Parse out the first vertical reference point of the section
        point_index = find(strcmpi({section_xml.Children.Name}, 'vertical_point_1'));
        point_xml = section_xml.Children(point_index);
        x_xml_index = find(strcmpi({point_xml.Children.Name}, 'x'));
        y_xml_index = find(strcmpi({point_xml.Children.Name}, 'y'));
        x_xml = point_xml.Children(x_xml_index);
        y_xml = point_xml.Children(y_xml_index);
        x = str2double(x_xml.Children(1).Data);
        y = str2double(y_xml.Children(1).Data);
        
        section.vertical_point_1 = [x y];
        
        %Parse out the second vertical reference point
        point_index = find(strcmpi({section_xml.Children.Name}, 'vertical_point_2'));
        point_xml = section_xml.Children(point_index);
        x_xml_index = find(strcmpi({point_xml.Children.Name}, 'x'));
        y_xml_index = find(strcmpi({point_xml.Children.Name}, 'y'));
        x_xml = point_xml.Children(x_xml_index);
        y_xml = point_xml.Children(y_xml_index);
        x = str2double(x_xml.Children(1).Data);
        y = str2double(y_xml.Children(1).Data);
        
        section.vertical_point_2 = [x y];
        
        %Parse the first horizontal reference point
        point_index = find(strcmpi({section_xml.Children.Name}, 'horizontal_point_1'));
        point_xml = section_xml.Children(point_index);
        x_xml_index = find(strcmpi({point_xml.Children.Name}, 'x'));
        y_xml_index = find(strcmpi({point_xml.Children.Name}, 'y'));
        x_xml = point_xml.Children(x_xml_index);
        y_xml = point_xml.Children(y_xml_index);
        x = str2double(x_xml.Children(1).Data);
        y = str2double(y_xml.Children(1).Data);
        
        section.horizontal_point_1 = [x y];
        
        %Parse the second horizontal reference point
        point_index = find(strcmpi({section_xml.Children.Name}, 'horizontal_point_2'));
        point_xml = section_xml.Children(point_index);
        x_xml_index = find(strcmpi({point_xml.Children.Name}, 'x'));
        y_xml_index = find(strcmpi({point_xml.Children.Name}, 'y'));
        x_xml = point_xml.Children(x_xml_index);
        y_xml = point_xml.Children(y_xml_index);
        x = str2double(x_xml.Children(1).Data);
        y = str2double(y_xml.Children(1).Data);
        
        section.horizontal_point_2 = [x y];
        
        %Parse out the ap location
        ap_location_index = find(strcmpi({section_xml.Children.Name}, 'ap_location'));
        ap_location_xml = section_xml.Children(ap_location_index);
        
        section.ap_location = str2double(ap_location_xml.Children(1).Data);
        
        %Parse out all of the cells
        cells = [];
        
        cells_index = find(strcmpi({section_xml.Children.Name}, 'cells'));
        cells_xml = section_xml.Children(cells_index);
        cell_indices = find(strcmpi({cells_xml.Children.Name}, 'cell'));
        for i = 1:length(cell_indices)
            %Iterate through cells
            
            %Get the current cell
            cell_xml = cells_xml.Children(cell_indices(i));
            
            %Parse out the x/y coordinates of the cell
            x_xml_index = find(strcmpi({cell_xml.Children.Name}, 'x'));
            y_xml_index = find(strcmpi({cell_xml.Children.Name}, 'y'));
            x_xml = cell_xml.Children(x_xml_index);
            y_xml = cell_xml.Children(y_xml_index);
            
            bad_cell = isempty(x_xml.Children) || isempty(y_xml.Children);
            if (~bad_cell)
                x = str2double(x_xml.Children(1).Data);
                y = str2double(y_xml.Children(1).Data);

                cells = [cells; x y];
            end
        end
        
        section.cells = cells;
        sections = [sections section];
    end

end

function theStruct = parseXML(filename)
    % PARSEXML Convert XML file to a MATLAB structure.
    try
       tree = xmlread(filename);
    catch
       error('Failed to read XML file %s.',filename);
    end

    % Recurse over child nodes. This could run into problems 
    % with very deeply nested trees.
    try
       theStruct = parseChildNodes(tree);
    catch
       error('Unable to parse XML file %s.',filename);
    end
end


% ----- Local function PARSECHILDNODES -----
function children = parseChildNodes(theNode)
    % Recurse over node children.
    children = [];
    if theNode.hasChildNodes
       childNodes = theNode.getChildNodes;
       numChildNodes = childNodes.getLength;
       allocCell = cell(1, numChildNodes);

       children = struct(             ...
          'Name', allocCell, 'Attributes', allocCell,    ...
          'Data', allocCell, 'Children', allocCell);

        for count = 1:numChildNodes
            theChild = childNodes.item(count-1);
            children(count) = makeStructFromNode(theChild);
        end
    end
end

% ----- Local function MAKESTRUCTFROMNODE -----
function nodeStruct = makeStructFromNode(theNode)
    % Create structure of node info.

    nodeStruct = struct(                        ...
       'Name', char(theNode.getNodeName),       ...
       'Attributes', parseAttributes(theNode),  ...
       'Data', '',                              ...
       'Children', parseChildNodes(theNode));

    if any(strcmp(methods(theNode), 'getData'))
       nodeStruct.Data = char(theNode.getData); 
    else
       nodeStruct.Data = '';
    end
end

% ----- Local function PARSEATTRIBUTES -----
function attributes = parseAttributes(theNode)
    % Create attributes structure.

    attributes = [];
    if theNode.hasAttributes
       theAttributes = theNode.getAttributes;
       numAttributes = theAttributes.getLength;
       allocCell = cell(1, numAttributes);
       attributes = struct('Name', allocCell, 'Value', ...
                           allocCell);

       for count = 1:numAttributes
          attrib = theAttributes.item(count-1);
          attributes(count).Name = char(attrib.getName);
          attributes(count).Value = char(attrib.getValue);
       end
    end
end