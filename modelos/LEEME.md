# Modelo de recorte de prendas

`u2netp.onnx` (4,6 MB): U²-Net en su versión pequeña (Qin et al., 2020; licencia Apache 2.0, github.com/xuebinqin/U-2-Net), en el formato ONNX que distribuye rembg (MIT). Lo ejecuta en el propio móvil onnxruntime-web (MIT), cargado desde jsDelivr solo al subir fotos. Si no carga, la app usa el relleno desde los bordes, que solo funciona con fondos lisos. En la app nativa (1.0) el recorte lo harán gratis las librerías del sistema: Vision en iPhone y ML Kit en Android.

# Modelo de reconocimiento de prendas (21/10/2026)

`ropa-mobileclip-s0.onnx` (45,5 MB): codificador de imagen de MobileCLIP-S0 (Apple, 2024; licencia de Apple para el modelo, código MIT), en la conversión ONNX de Xenova/mobileclip_s0 (`onnx/vision_model.onnx`, fp32; la versión cuantizada de 12 MB no sirve: da resultados al azar). `ropa-textos.json`: 48 descripciones de prendas en inglés («a photo of a skirt, clothing product photo»…) ya pasadas por el codificador de texto, agrupadas en las 8 categorías del clóset; la app elige la categoría de la descripción más parecida. Prueba con las 24 fotos de Sheila (12 originales y 12 recortadas): 23 aciertos (falla un vestido cruzado, tomado por abrigo). Se rehace con `scratchpad/clip/textos.mjs` y `evaluar.mjs` (transformers.js 3.7.5 en Node).
