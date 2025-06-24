---
layout: archive
title: "Curriculum Vitae"
permalink: /cv/
author_profile: true
---

<div id="pdf-container"></div>

<p>If the PDF does not appear, <a href="https://ashwin-baduni.github.io/files/CV.pdf">download my CV here</a>.</p>

<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js"></script>
<script>
  // Set the path to the PDF worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

  // The PDF file you want to display (full absolute path)
  var url = 'https://ashwin-baduni.github.io/files/CV.pdf';

  // Load the PDF
  pdfjsLib.getDocument(url).promise.then(function(pdf) {
    var container = document.getElementById('pdf-container');
    // Iterate through each page
    for (let i = 1; i <= pdf.numPages; i++) {
      pdf.getPage(i).then(function(page) {
        var scale = 1.5;
        var viewport = page.getViewport({ scale: scale });

        var canvas = document.createElement('canvas');
        canvas.className = 'pdf-page-canvas';
        var context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        container.appendChild(canvas);

        var renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        page.render(renderContext);

        canvas.style.marginBottom = '20px';
      });
    }
  }).catch(function(error) {
    console.error('Error loading PDF:', error);
    document.getElementById('pdf-container').innerHTML = '<p>Error loading PDF. <a href="' + url + '">Download CV here.</a></p>';
  });
</script>
