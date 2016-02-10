import socket
import time
 
def process(data):
    print "Processing received data..."
    time.sleep(5)
    print "Data processed!"

def main():
    # Create a socket object
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)         
    # Get local machine name
    host = socket.gethostname() 
    port = 33333
    # Bind socket to the port
    s.bind((host, port))   
    print "Listening on port %s" % port
 
    # Prepare for client connections to come in;
    # backlog of 5 connections
    s.listen(5)

    while True:
        try:
            # Wait until an incoming connection is received
            conn, addr = s.accept()
            print 'Incoming connection from ', addr
            while True:
                data = conn.recv(1024)
                if not data:    
                    # Close connection and wait for new connections
                    conn.close()
                    break
                else:
                    print "Received data: %s" % data
                    process(data)

        except KeyboardInterrupt:
            print
            print "Interrupted!"
            break
        except socket.error, msg:
            print "Socket error! %s" % msg
            break
 
if __name__ == "__main__":
    main()