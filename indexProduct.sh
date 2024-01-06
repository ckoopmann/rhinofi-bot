trap "echo Exited!; exit;"  SIGINT SIGTERM
while true; do node indexProduct.js; done
