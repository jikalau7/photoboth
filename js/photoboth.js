const video = document.getElementById("webCamVideo");
const countdownEl = document.getElementById("countdown");
const container = document.getElementById("photobooth-container");
const startBtn = document.getElementById("startBtn");
const captureBtn = document.getElementById("captureBtn");
const previewContainer = document.getElementById("preview-container");
const finalCard = document.getElementById("finalCard");
const frameTemplate = document.getElementById("frameTemplate");

let photos = [];
let stream = null;
let frameImage = null;
let frameIsLoaded = false;

// Frame dimensions
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 2000;

// 3 photo areas shifted so photos sit under the pink header area of the frame
const PHOTO_AREAS = [
  { x: 502, y: 130, width: 600, height: 460 },  // Area 1 (atas): height +10, up 5px
  { x: 502, y: 605, width: 600, height: 460 },  // Area 2 (tengah): height +10, up 5px
  { x: 502, y: 1145, width: 600, height: 460 }  // Area 3 (bawah): height +10, up 5px
];

// Load frame template - fetch as blob to avoid CORS taint
window.addEventListener('load', () => {
  console.log('✅ Window load event fired');
  console.log('📍 Current URL:', window.location.href);
  
  // Fetch frame as blob to ensure it's truly same-origin
  fetch('assets/frame1.png')
    .then(res => res.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const frameImg = new Image();
      
      frameImg.onload = () => {
        frameImage = frameImg;
        frameIsLoaded = true;
        console.log('✅✅✅ FRAME LOADED SUCCESSFULLY!');
        console.log('Frame size:', frameImage.width, 'x', frameImage.height);
        
        // Display preview
        const img = document.createElement('img');
        img.src = blobUrl;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '400px';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '8px';
        img.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        frameTemplate.appendChild(img);

        // Create a hidden print-only frame image (will be used for printing just the pink frame)
        const frameOnly = document.createElement('img');
        frameOnly.id = 'frameOnlyPrint';
        frameOnly.src = blobUrl;
        frameOnly.style.display = 'none';
        frameOnly.alt = 'Frame for print';
        document.body.appendChild(frameOnly);
      };
      
      frameImg.onerror = (e) => {
        console.error('❌ Frame load FAILED!', e);
        frameTemplate.innerHTML = '<p style="color:red; font-weight:bold;">❌ Frame tidak ditemukan!</p>';
      };
      
      frameImg.src = blobUrl;
    })
    .catch(err => {
      console.error('❌ Fetch frame failed:', err);
      frameTemplate.innerHTML = '<p style="color:red; font-weight:bold;">❌ Error loading frame!</p>';
    });
});

// Function to composite 3 photos into frame (final result)
function compositeFinalCard(photoDataUrls) {
  return new Promise((resolve, reject) => {
    console.log('=== FINAL COMPOSITE START ===');
    console.log('Photos to composite:', photoDataUrls.length);
    console.log('Frame loaded?', frameIsLoaded);
    
    if (!frameIsLoaded || !frameImage) {
      console.error('❌ Frame not loaded for final composite');
      reject('Frame not loaded');
      return;
    }

    try {
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = CANVAS_WIDTH;
      compositeCanvas.height = CANVAS_HEIGHT;
      const ctx = compositeCanvas.getContext('2d');
      
      console.log('Canvas created:', CANVAS_WIDTH, 'x', CANVAS_HEIGHT);
      
      // Fill white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Draw all 3 photos (frame will be drawn on top after photos load)
      // If on small screens, shift the 3rd photo slightly up so it fits better
      const isMobile = (typeof window !== 'undefined') && window.matchMedia && window.matchMedia('(max-width:480px)').matches;
      const thirdPhotoMobileShift = isMobile ? 40 : 0; // px to move up on mobile
      let loadedCount = 0;
      const photosToLoad = Math.min(3, photoDataUrls.length);

      // helper to draw frame on top before exporting
      const drawFrameOnTop = () => {
        try {
          ctx.drawImage(frameImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          console.log('✅ Frame drawn on top');
        } catch(err) {
          console.error('❌ Error drawing frame on top:', err);
        }
      };
      
      photoDataUrls.forEach((photoDataUrl, index) => {
        if (index >= 3) return; // Max 3 photos

        const photoImg = new Image();
        // Data URLs are always same-origin, do NOT set crossOrigin
        // Setting crossOrigin on data URLs causes canvas to be tainted
        
        const baseArea = PHOTO_AREAS[index];
        const area = Object.assign({}, baseArea);
        if(index === 2 && thirdPhotoMobileShift) {
          area.y = baseArea.y - thirdPhotoMobileShift;
        }
        
        photoImg.onload = () => {
          try {
            console.log(`✅ Photo ${index + 1} loaded:`, photoImg.width, 'x', photoImg.height);
            
            // Cover area: scale image so it fills the area and center-crop (no white bars)
            const scale = Math.max(area.width / photoImg.width, area.height / photoImg.height);
            const drawWidth = photoImg.width * scale;
            const drawHeight = photoImg.height * scale;
            const drawX = area.x + (area.width - drawWidth) / 2;
            const drawY = area.y + (area.height - drawHeight) / 2;

            console.log(`📍 Drawing photo ${index + 1} at:`, { drawX, drawY, drawWidth, drawHeight });
            ctx.drawImage(photoImg, drawX, drawY, drawWidth, drawHeight);
            
            loadedCount++;
            console.log(`✅ Photo ${index + 1} drawn (${loadedCount}/${photosToLoad})`);
            
            // All photos drawn, draw frame on top then resolve
            if (loadedCount === photosToLoad) {
              drawFrameOnTop();
              const result = compositeCanvas.toDataURL('image/jpeg', 0.95);
              console.log('✅ FINAL COMPOSITE complete, size:', (result.length / 1024).toFixed(2), 'KB');
              console.log('=== FINAL COMPOSITE END ===');
              resolve(result);
            }
            } catch(err) {
            console.error(`❌ Error drawing photo ${index + 1}:`, err);
            loadedCount++;
            if (loadedCount === photosToLoad) {
              drawFrameOnTop();
              resolve(compositeCanvas.toDataURL('image/jpeg', 0.95));
            }
          }
        };
        
        photoImg.onerror = (e) => {
          console.error(`❌ Error loading photo ${index + 1}:`, e);
          loadedCount++;
          if (loadedCount === photosToLoad) {
            drawFrameOnTop();
            resolve(compositeCanvas.toDataURL('image/jpeg', 0.95));
          }
        };
        
        photoImg.src = photoDataUrl;
      });
      
    } catch(err) {
      console.error('❌ Error in compositeFinalCard:', err);
      reject(err);
    }
  });
}

startBtn.onclick = async () => {
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:true});
    video.srcObject = stream;
    container.style.display = "block";
    startBtn.style.display = "none";
    captureBtn.style.display = "inline-block";
    document.getElementById("frameSelector").style.display = "none";
    photos = [];
    previewContainer.innerHTML = "";
    previewContainer.style.display = "none";
    finalCard.style.display = "none";
    finalCard.innerHTML = "";
  }catch(err){
    alert("Tidak bisa akses kamera");
  }
};

captureBtn.onclick = () => {
  if(photos.length >= 3) return;

  let count = 3;
  countdownEl.textContent = count;

  const timer = setInterval(()=>{
    count--;
    if(count > 0){
      countdownEl.textContent = count;
    }else{
      clearInterval(timer);
      countdownEl.textContent = "";
      ambilFoto();
    }
  },1000);
};

function ambilFoto(){

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.scale(-1, 1);
  ctx.drawImage(video,-canvas.width,0,canvas.width,canvas.height);

  const imgData = canvas.toDataURL("image/jpeg");
  photos.push(imgData);
  
  console.log('📸 Foto diambil, index:', photos.length - 1, 'Total:', photos.length);

  if(photos.length < 3){
    previewContainer.style.display = "flex";
    previewContainer.style.flexDirection = "column";
    previewContainer.style.alignItems = "center";
    
    const wrapper = document.createElement("div");
    wrapper.style.width = "100%";
    wrapper.style.maxWidth = "400px";
    
    const img = document.createElement("img");
    img.src = imgData;
    img.className = "preview-img";
    img.style.width = "100%";
    img.style.height = "auto";
    wrapper.appendChild(img);
    
    previewContainer.appendChild(wrapper);
    
    // Show count
    const countSpan = document.createElement('span');
    countSpan.style.textAlign = 'center';
    countSpan.style.fontSize = '12px';
    countSpan.style.color = '#666';
    countSpan.style.marginTop = '10px';
    countSpan.textContent = `Foto ${photos.length} dari 3`;
    previewContainer.appendChild(countSpan);
    
    console.log('Preview ditampilkan');
  }

  if(photos.length === 3){
    console.log('🎉 3 foto selesai! Composite final card...');

    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;

    // Composite all 3 photos into frame
    compositeFinalCard(photos).then(finalCompositeImage => {
      console.log('✅ Final composite berhasil');
      
      container.style.display = "block";
      video.style.display = "none";
      countdownEl.style.display = "none";
      document.querySelector(".buttons").style.display = "none";
      previewContainer.style.display = "none";
      document.getElementById("frameSelector").style.display = "none";

      // Display final composite image
      const img = document.createElement("img");
      img.src = finalCompositeImage;
      img.style.width = "100%";
      img.style.height = "auto";
      img.style.maxWidth = "400px";
      // Ensure the hidden print element uses the composite (so print includes photos)
      const frameOnlyEl = document.getElementById('frameOnlyPrint');
      if(frameOnlyEl){
        frameOnlyEl.src = finalCompositeImage;
      } else {
        const fo = document.createElement('img');
        fo.id = 'frameOnlyPrint';
        fo.src = finalCompositeImage;
        fo.style.display = 'none';
        document.body.appendChild(fo);
      }

      finalCard.appendChild(img);

      const printBtn = document.createElement("button");
      printBtn.id = "printBtn";
      printBtn.textContent = "Cetak ke PDF";
      printBtn.onclick = () => window.print();
      finalCard.appendChild(printBtn);

      finalCard.style.display = "flex";
      console.log('✅ Final card ditampilkan');
    }).catch(err => {
      console.error('❌ Error compositing final card:', err);
      alert('Error saat membuat final card');
    });
  }
}
