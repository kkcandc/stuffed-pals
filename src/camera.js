const MAX_EDGE = 720;

export function cameraMessage(err) {
  const name = err?.name || "";
  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError"
  ) {
    return "The camera is blocked. Allow camera access in your browser, then tap Try again.";
  }
  if (name === "NotFoundError") {
    return "No camera was found. Check that a camera is connected, then tap Try again.";
  }
  if (name === "UnsupportedError") {
    return "This browser cannot open the camera here. You can still open the camera app below.";
  }
  return "The camera did not open. Tap Try again.";
}

export async function openCamera(video) {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error("unsupported");
    err.name = "UnsupportedError";
    throw err;
  }

  const attempts = [
    {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 960 },
        height: { ideal: 1280 },
      },
    },
    { audio: false, video: true },
  ];

  let last = new Error("failed");
  last.name = "AbortError";

  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      try {
        await video.play();
      } catch (err) {
        stopStream(stream);
        throw err;
      }
      return stream;
    } catch (err) {
      last = err;
      if (
        err?.name === "NotAllowedError" ||
        err?.name === "PermissionDeniedError" ||
        err?.name === "SecurityError"
      ) {
        throw err;
      }
    }
  }

  throw last;
}

export function stopStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

export async function waitForFrame(video, isCurrent, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isCurrent()) return false;
    if (video.videoWidth > 0 && video.videoHeight > 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  return false;
}

export function drawPhoto(source) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  if (!sw || !sh) {
    const err = new Error("empty");
    err.name = "EmptyPhotoError";
    throw err;
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export function fileToPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const photo = drawPhoto(img);
        URL.revokeObjectURL(url);
        resolve(photo);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(Object.assign(new Error("unreadable"), { name: "UnreadablePhotoError" }));
    };
    img.src = url;
  });
}
