#!/bin/bash

LOG_SERVER="${LOG_SERVER:-https://wait.example.com}"

display_usage() { 
    echo -e "Usage: $0 [arguments]" 
    echo -e "   create-key          create developer key pair"
    echo -e "   print-key           print developer public key"
    echo -e "   submit-app URL      submit app at URL to log server"
    echo -e "   refresh-proof URL   refresh log proof for app at URL"
} 

if [ $# -lt 1 ]; then 
    display_usage
    exit 1
fi 

case "$1" in
    "create-key")
        if [ -f "private.pem" ]; then
            echo -e "Error: private.pem already exists"
            exit 1
        fi
        openssl ecparam -genkey -name prime256v1 -noout -out private.pem
        echo "Secret key written to 'private.pem'"
        openssl ec -in private.pem -pubout -out public.pem 2> /dev/null
        echo "Public key written to 'public.pem'"
        echo "Add the following line to your application's main document, to link it to your key:"
        echo "   <meta name=\"wait-developer-key\" content=\"$(sed '1d;$d' public.pem | tr -d '\n')\">"
        ;;

    "print-key")
        if [ ! -f "private.pem" ]; then
            echo -e "Error: private.pem not found"
            echo -e "Make sure to run $0 create-key first"
            exit 1
        fi
        echo "Add the following line to your application's main document, to link it to your key:"
        echo "   <meta name=\"wait-developer-key\" content=\"$(sed '1d;$d' public.pem | tr -d '\n')\">"
        ;;

    "submit-app" | "refresh-proof")
        if [ ! -f "private.pem" ]; then
            echo -e "Error: private.pem not found"
            echo -e "Make sure to run $0 create-key first"
            exit 1
        fi

        if [ $# -lt 2 ]; then 
            display_usage
            exit 1
        fi 

        signature=$(curl -s "$2" | openssl dgst -sha512 -sign private.pem | xxd -p | tr -d '\n')
        proof=$(curl -s -d "url=$2&signature=$signature&mode=$1" $LOG_SERVER)
        echo "Proof for $2 is:"
        echo $proof
        ;;

    *)
        display_usage
        exit 1
        ;;
esac
