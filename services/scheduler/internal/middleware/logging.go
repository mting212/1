package middleware

import (
	"context"
	"log"
	"runtime/debug"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// UnaryLoggingInterceptor logs every gRPC unary request with method name, duration, and status.
func UnaryLoggingInterceptor(
	ctx context.Context,
	req interface{},
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (interface{}, error) {
	start := time.Now()

	resp, err := handler(ctx, req)

	duration := time.Since(start)
	code := status.Code(err)

	if err != nil {
		log.Printf("[gRPC] %s → %s (%.3fms) error: %v",
			info.FullMethod, code, float64(duration.Microseconds())/1000, err)
	} else {
		log.Printf("[gRPC] %s → %s (%.3fms)",
			info.FullMethod, code, float64(duration.Microseconds())/1000)
	}

	return resp, err
}

// UnaryPanicRecoveryInterceptor catches panics in gRPC handlers and converts them to Internal errors.
func UnaryPanicRecoveryInterceptor(
	ctx context.Context,
	req interface{},
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (resp interface{}, err error) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[gRPC] PANIC in %s: %v\n%s", info.FullMethod, r, string(debug.Stack()))
			err = status.Errorf(codes.Internal, "internal server error")
		}
	}()

	return handler(ctx, req)
}
