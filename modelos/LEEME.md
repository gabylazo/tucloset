# Modelo de recorte de prendas

`u2netp.onnx` (4,6 MB): U²-Net en su versión pequeña (Qin et al., 2020; licencia Apache 2.0, github.com/xuebinqin/U-2-Net), en el formato ONNX que distribuye rembg (MIT). Lo ejecuta en el propio móvil onnxruntime-web (MIT), cargado desde jsDelivr solo al subir fotos. Si no carga, la app usa el relleno desde los bordes, que solo funciona con fondos lisos. En la app nativa (1.0) el recorte lo harán gratis las librerías del sistema: Vision en iPhone y ML Kit en Android.
