ordering = [
"waist_circumference_pref_mm",
"chest_circumference_mm",
"hip_circumference_maximum_mm",
"stature_mm",
"weight_cube_root_kg",
"inseam_right_mm",
"fitness_hours"
];
filenames = [
"waist_circumference_pref_plus_5mm",
"chest_circumference_plus_5mm",
"hip_circumference_maximum_plus_5mm",
"stature_plus_5mm",
"weight_cube_root_plus_5kg",
"inseam_right_plus_5mm",
"fitness_plus_5hours"
];
means = [ 7.564329e+02, 9.285578e+02, 1.023178e+03, 1.642320e+03, 3.997508e+00, 7.551578e+02, 4.012371e+00 ]; 
covariance = [
[ 8.974942e+03, 7.552090e+03, 6.483763e+03, 8.309763e+02, 1.881021e+01, 1.558322e+02, -9.556207e+00 ],
[ 7.552090e+03, 8.392775e+03, 6.396354e+03, 7.149492e+02, 1.892354e+01, 3.602916e+01, -7.956077e+00 ],
[ 6.483763e+03, 6.396354e+03, 7.615241e+03, 1.194057e+03, 1.890881e+01, 2.847339e+02, -1.766251e+01 ],
[ 8.309763e+02, 7.149492e+02, 1.194057e+03, 4.746183e+03, 5.688103e+00, 2.841976e+03, 1.125533e+01 ],
[ 1.881021e+01, 1.892354e+01, 1.890881e+01, 5.688103e+00, 5.485452e-02, 2.377624e+00, -1.012215e-02 ],
[ 1.558322e+02, 3.602916e+01, 2.847339e+02, 2.841976e+03, 2.377624e+00, 2.142281e+03, 7.671730e+00 ],
[ -9.556207e+00, -7.956077e+00, -1.766251e+01, 1.125533e+01, -1.012215e-02, 7.671730e+00, 9.684213e+00 ]
]; 

if (model_loader != undefined ) { model_loader.finish_loading_shapeinfo(filenames, means, covariance); }

