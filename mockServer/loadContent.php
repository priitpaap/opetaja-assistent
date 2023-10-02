<?php

// Use $_GET['path'] to get the path from the query parameter
$path = $_GET['url'] ?? '';

// Remove the protocol, the host, and potentially the port, leading hash or slash from the path
$path = preg_replace(['/^https?:\/\/[^\/]+(:\d+)?/','/^[\/#]*/'], '', $path);

$baseDir = realpath('./html_files/');

// Replace the unsupported characters in the path with paragraph signs
$path = str_replace('?', '§', $path);
$path = str_replace(':', '§', $path);

// Convert path to realpath to avoid directory traversal attacks
$path = realpath($baseDir . '/'. $path);

// Check if the file exists in the html_files directory and is within the base directory
if (!$path || strpos($path, $baseDir) !== 0 || !file_exists($path)) {
    http_response_code(404);
    $keys = [
        'REQUEST_METHOD',
        'REQUEST_URI',
        'QUERY_STRING',
        'SCRIPT_NAME',
        'SCRIPT_FILENAME',
        'PHP_SELF',
        'DOCUMENT_ROOT',
        'PATH_TRANSLATED',
        'PATH_INFO',
        'ORIG_PATH_INFO',
    ];

    echo "<h1>404 Not Found</h1>";
    echo "<p>The requested file \"{$path}\" was not found on this server.</p><hr>";

    foreach ($keys as $key) {
        echo "<p>{$key}: " . (isset($_SERVER[$key]) ? $_SERVER[$key] : 'Not set') . "</p>";
    }

    exit;
}

// Serve the file with a text/html content type header
header('Content-Type: text/html');

// Generate red borders to indicate that this is a test server
echo <<<HTML
<div style="z-index: 100; top: 0; left: 0; right: 0; background: #f00; color: #fff; padding: 10px; text-align: center;">
HTML;



readfile($path);
