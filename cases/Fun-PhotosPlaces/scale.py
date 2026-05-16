import cv2


img_bgr = cv2.imread("photos_2017_7_6_fst_building-facade-windows.jpg")

shape = img_bgr.shape
print("Original image shape:", shape)
resized_scaled = cv2.resize(img_bgr, None, fx=0.25, fy=0.25)
cv2.imwrite("photos_2017_7_6_fst_building-facade-windows_scaled.jpg", resized_scaled)
