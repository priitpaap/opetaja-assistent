<?php

// Get the path from the URL
$path =$_SERVER['REQUEST_URI'] ?? '';

// Check if the path starts with /hois_back/
if (strpos($path, '/hois_back/') === 0) {
    // Assume the file is in a directory named 'json_files' and has a .json extension
    $filePath = './json_files' . $path . '.json';

    // Serve the file with a JSON content type header
    header('Content-Type: application/json');
    if (file_exists($filePath)) {
        readfile($filePath);
    } else {
        // Send a 404 response if the file doesn't exist
        http_response_code(404);
        echo json_encode(['error' => 'File not found!']);
    }
    exit;
}

// Serve the file with a text/html content type header
header('Content-Type: text/html');
file_get_contents('./index.html');