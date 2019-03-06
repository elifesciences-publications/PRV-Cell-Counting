

### This code is associated with the paper from Ganzer et al., "Closed-loop neuromodulation restores network connectivity and motor control after spinal cord injury". eLife, 2018. http://dx.doi.org/10.7554/eLife.32058


# PRV-Cell-Counting
This software was written for the Texas Biomedical Device Center at UT Dallas by David Pruitt. The purpose of this software is to allow the user to perform manual counting of cells labeled with fluorescent proteins in brain tissue. It was primarily developed for researchers using pseudorabies virus (PRV), which is a retrograde neuronal tracer. Histological images used by this program must use the Microsoft DeepZoom format, as these images can be very large and memory intensive. To handle these image sizes, this software uses OpenSeadragon to load and display the DeepZoom images. 

Originally, when this software was being developed, images were being scanned using a Hamamatsu Nanozoom. Images were converted from the native Hamamatsu format to the Microsoft DeepZoom format using libvips (https://jcupitt.github.io/libvips/). Any whole-slide scanner can be used to take images, as long as you can then convert the image files to the DeepZoom format. This should not be difficult using the aforementioned libvips software.

The main release of this software can be found in the releases tab (or at this link: https://github.com/davepruitt/PRV-Cell-Counting/releases). Any questions can be directed to David Pruitt, the author of this software.
