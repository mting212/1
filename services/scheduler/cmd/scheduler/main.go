package main

import (
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/meetflow/scheduler/internal"
	"github.com/meetflow/scheduler/internal/booking"
	"github.com/meetflow/scheduler/internal/middleware"
	schedulerv1 "github.com/meetflow/scheduler/proto/scheduler/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

func main() {
	// Initialize the in-memory store and booking service.
	// In production, this would use a PostgreSQL-backed store.
	store := booking.NewInMemoryStore()
	svc := booking.NewBookingService(store)

	// Create the gRPC server with interceptors
	server := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			middleware.UnaryPanicRecoveryInterceptor,
			middleware.UnaryLoggingInterceptor,
		),
	)

	// Register the scheduler service
	handler := internal.NewSchedulerHandler(svc)
	schedulerv1.RegisterSchedulerServiceServer(server, handler)

	// Enable server reflection for debugging with grpcurl
	reflection.Register(server)

	// Listen on port 9090
	lis, err := net.Listen("tcp", ":9090")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	log.Println("Scheduler gRPC server listening on :9090")

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		sig := <-sigCh
		log.Printf("received signal %v, shutting down gracefully...", sig)

		// Give in-flight requests up to 30 seconds to complete
		done := make(chan struct{})
		go func() {
			server.GracefulStop()
			close(done)
		}()

		select {
		case <-done:
			log.Println("server stopped gracefully")
		case <-time.After(30 * time.Second):
			log.Println("graceful stop timed out, forcing shutdown")
			server.Stop()
		}
	}()

	if err := server.Serve(lis); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
