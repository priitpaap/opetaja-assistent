# Tahvel.edu.ee mock server

## Requirements

1. Apache
2. PHP

# Installation

1. Install Apache and PHP, for example on Windows you can use [XAMPP](https://www.apachefriends.org/index.html)
2. Create a new HTTPS virtual server tahvel.edu.ee in XAMPP and point its document root to the root of this directory
3. Add the following line to your hosts file: `::1 tahvel.edu.ee`. On Windows the hosts file is located at `C:\Windows\System32\drivers\etc\hosts` and you need to run your text editor as administrator to be able to save the file.
4. Visit [https://tahvel.edu.ee/#journals?_menu](https://tahvel.edu.ee/#journals?_menu) and accept the self-signed certificate. You should see that the page has red borders, indicating that it is a mock server.