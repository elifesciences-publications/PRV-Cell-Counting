# PRV-Cell-Counting
This software was written for the Texas Biomedical Device Center at UT Dallas by David Pruitt. The purpose of this software is to perform manual counting of cells labeled with fluorescent proteins in brain tissue. Images must use the Microsoft DeepZoom format, as these histological images can be very large and memory intensive. To handle these image sizes, this software uses OpenSeadragon to load and display the DeepZoom images. 

Originally, when this software was being developed, images were being scanned using a Hamamatsu Nanozoom. Images were converted from the native Hamamatsu format to the Microsoft DeepZoom format using libvips (https://jcupitt.github.io/libvips/). Any whole-slide scanner can be used to take images, as long as you can then convert the image files to the DeepZoom format. This should not be difficult using the aforementioned libvips software.

The main release of this software can be found in the releases tab. Any questions can be directed to David Pruitt, the author of this software.
