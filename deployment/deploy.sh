#!/bin/bash
# MedicaLink Deployment Script for Linux/macOS
# Usage: ./deploy.sh [command] [service]
# Commands: start, stop, restart, logs, build, status, update
# Services: all, infrastructure, gateway, accounts, provider, booking, content, notification, orchestrator

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "\n${CYAN} $1 $2...${NC}"
}

print_success() {
    echo -e "${GREEN} $1${NC}"
}

print_error() {
    echo -e "${RED} $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}  $1${NC}"
}

show_help() {
    echo "MedicaLink Deployment Script"
    echo "Usage: $0 <command> [service] [options]"
    echo ""
    echo "Commands:"
    echo "  start [service]    - Start service(s)"
    echo "  stop [service]     - Stop service(s)"
    echo "  restart [service]  - Restart service(s)"
    echo "  logs [service]     - Show logs for service(s)"
    echo "  build [service]    - Build service(s)"
    echo "  status [service]   - Show status of service(s)"
    echo "  update [service]   - Update and restart service(s)"
    echo "  force-rebuild [service] - Force complete rebuild and recreation"
    echo ""
    echo "Services:"
    echo "  all                - All services"
    echo "  infrastructure     - Database, Redis, RabbitMQ"
    echo "  accounts           - Accounts service"
    echo "  api-gateway        - API Gateway"
    echo "  booking            - Booking service"
    echo "  content            - Content service"
    echo "  notification       - Notification service"
    echo "  orchestrator       - Orchestrator service"
    echo "  provider           - Provider Directory service"
    echo ""
    echo "Examples:"
    echo "  $0 start all"
    echo "  $0 restart api-gateway"
    echo "  $0 logs booking"
    echo "  $0 update accounts"
    echo "  $0 force-rebuild booking"
}

# Validate arguments
if [ $# -lt 1 ]; then
    show_help
    exit 1
fi

COMMAND=$1
SERVICE=${2:-all}

# Validate command
case $COMMAND in
    start|stop|restart|logs|build|status|update)
        ;;
    *)
        print_error "Invalid command: $COMMAND"
        exit 1
        ;;
esac

# Validate service
case $SERVICE in
    all|infrastructure|gateway|accounts|provider|booking|content|notification|orchestrator)
        ;;
    *)
        print_error "Invalid service: $SERVICE"
        exit 1
        ;;
esac

# Set working directory to project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Load environment variables
if [ -f ".env.production" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
    print_success "Environment variables loaded from .env.production"
else
    print_warning ".env.production not found!"
fi

# Define service file mappings
declare -A SERVICE_FILES
SERVICE_FILES[all]="$PROJECT_ROOT/deployment/docker-compose.yml"
SERVICE_FILES[infrastructure]="$PROJECT_ROOT/deployment/docker-compose.infrastructure.yml"
SERVICE_FILES[gateway]="$PROJECT_ROOT/deployment/docker-compose.gateway.yml"
SERVICE_FILES[accounts]="$PROJECT_ROOT/deployment/docker-compose.accounts.yml"
SERVICE_FILES[provider]="$PROJECT_ROOT/deployment/docker-compose.provider.yml"
SERVICE_FILES[booking]="$PROJECT_ROOT/deployment/docker-compose.booking.yml"
SERVICE_FILES[content]="$PROJECT_ROOT/deployment/docker-compose.content.yml"
SERVICE_FILES[notification]="$PROJECT_ROOT/deployment/docker-compose.notification.yml"
SERVICE_FILES[orchestrator]="$PROJECT_ROOT/deployment/docker-compose.orchestrator.yml"

# Get compose file for the specified service
COMPOSE_FILE=${SERVICE_FILES[$SERVICE]}

# Execute commands
case $COMMAND in
    start)
        print_header "Starting" $SERVICE
        docker compose -f "$COMPOSE_FILE" up -d
        print_success "$SERVICE started successfully"
        ;;
    
    stop)
        print_header "Stopping" $SERVICE
        docker compose -f "$COMPOSE_FILE" down
        print_success "$SERVICE stopped successfully"
        ;;
    
    restart)
        print_header "Restarting" $SERVICE
        docker compose -f "$COMPOSE_FILE" restart
        print_success "$SERVICE restarted successfully"
        ;;
    
    logs)
        print_header "Showing logs for" $SERVICE
        if [ "$SERVICE" != "all" ] && [ "$SERVICE" != "infrastructure" ]; then

            if ! docker network ls | grep -q medicalink-network; then
                echo -e "${YELLOW}  Creating medicalink-network...${NC}"
                docker network create medicalink-network 2>/dev/null || true
            fi

            docker compose -f "$COMPOSE_FILE" logs -f
        else
            docker compose -f "$COMPOSE_FILE" logs -f
        fi
        ;;
    
    build)
        print_header "Building" $SERVICE
        # Use limited parallelism to prevent resource exhaustion
        case $SERVICE in
            all|infrastructure)
                # Infrastructure services can use more parallelism
                COMPOSE_PARALLEL_LIMIT=2 docker compose -f "$COMPOSE_FILE" build --no-cache --parallel
                ;;
            *)
                # Individual services use limited parallelism (sequential build)
                docker compose -f "$COMPOSE_FILE" build --no-cache
                ;;
        esac
        print_success "$SERVICE built successfully"
        ;;
    
    status)
        print_header "Checking status of" $SERVICE
        docker compose -f "$COMPOSE_FILE" ps
        ;;
    
    update)
        print_header "Updating" $SERVICE
        
        # Check available memory before proceeding
        AVAILABLE_MEM=$(free -m | awk 'NR==2{printf "%.0f", $7}')
        if [ "$AVAILABLE_MEM" -lt 512 ]; then
            print_warning "Low available memory (${AVAILABLE_MEM}MB). Using conservative build settings."
        fi
        
        echo -e "${YELLOW} Installing dependencies...${NC}"
        cd "$PROJECT_ROOT"
        timeout 300 pnpm install || {
            print_error "Dependency installation timed out"
            exit 1
        }
        
        # Gracefully stop existing service first
        echo -e "${YELLOW} Stopping existing service...${NC}"
        docker compose -f "$COMPOSE_FILE" down --timeout 30 || true
        
        # Clean up Docker resources to free memory (with timeout and safer approach)
        echo -e "${YELLOW} Cleaning up Docker resources...${NC}"
        
        # Clean up containers first
        echo -e "${YELLOW}   Removing stopped containers...${NC}"
        timeout 60 docker container prune -f || true
        
        # Clean up networks (skip if in use)
        echo -e "${YELLOW}   Removing unused networks...${NC}"
        timeout 30 docker network prune -f || true
        
        # Clean up volumes (be more careful)
        echo -e "${YELLOW}   Removing unused volumes...${NC}"
        timeout 30 docker volume prune -f || true
        
        # Skip full system prune to avoid hanging
        echo -e "${YELLOW}   Skipping full system prune to prevent hanging...${NC}"
        
        # Remove existing images to force complete rebuild (with timeout)
        echo -e "${YELLOW} Removing existing images to force rebuild...${NC}"
        case $SERVICE in
            all)
                echo -e "${YELLOW}   Removing all medicalink images...${NC}"
                timeout 120 bash -c 'docker images | grep -E "(medicalink-|medicalink_)" | awk "{print \$3}" | xargs -r docker rmi -f' || {
                    echo -e "${YELLOW}   Some images could not be removed (may be in use)${NC}"
                }
                ;;
            infrastructure)
                # Infrastructure services don't need image removal
                echo -e "${YELLOW}   Skipping image removal for infrastructure services${NC}"
                ;;
            *)
                echo -e "${YELLOW}   Removing images for $SERVICE...${NC}"
                timeout 60 bash -c "docker images | grep \"medicalink.*$SERVICE\" | awk '{print \$3}' | xargs -r docker rmi -f" || {
                    echo -e "${YELLOW}   Some $SERVICE images could not be removed (may be in use)${NC}"
                }
                ;;
        esac
        
        # Build with specific parallelism limits to prevent resource exhaustion
        echo -e "${YELLOW} Building Docker images with forced rebuild (includes Prisma generation and NestJS build)...${NC}"
        case $SERVICE in
            all)
                # Build all services sequentially to prevent resource exhaustion
                docker compose -f "$COMPOSE_FILE" build --no-cache
                ;;
            infrastructure)
                # Infrastructure services can use slightly more parallelism
                COMPOSE_PARALLEL_LIMIT=2 docker compose -f "$COMPOSE_FILE" build --no-cache --parallel
                ;;
            content|booking|notification|provider)
                # Services with Prisma need extra care (sequential build)
                docker compose -f "$COMPOSE_FILE" build --no-cache
                ;;
            *)
                # Other services use sequential build
                docker compose -f "$COMPOSE_FILE" build --no-cache
                ;;
        esac
        
        echo -e "${YELLOW} Starting services with forced recreation...${NC}"
        docker compose -f "$COMPOSE_FILE" up -d --force-recreate
        
        # Wait for service to be ready
        echo -e "${YELLOW} Waiting for service to be ready...${NC}"
        sleep 15
        
        # Verify service health
        echo -e "${YELLOW} Verifying service health...${NC}"
        docker compose -f "$COMPOSE_FILE" ps
        
        print_success "$SERVICE updated successfully with forced rebuild"
        ;;
    
    force-rebuild)
        print_header "Force rebuilding" $SERVICE
        
        echo -e "${YELLOW} Installing dependencies...${NC}"
        cd "$PROJECT_ROOT"
        timeout 300 pnpm install || {
            print_error "Dependency installation timed out"
            exit 1
        }
        
        # Stop and remove all containers, networks, and volumes
        echo -e "${YELLOW} Stopping and removing all containers, networks, and volumes...${NC}"
        docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans --timeout 30 || true
        
        # Remove all related images
        echo -e "${YELLOW} Removing all related Docker images...${NC}"
        case $SERVICE in
            all)
                docker images | grep -E "(medicalink-|medicalink_)" | awk '{print $3}' | xargs -r docker rmi -f || true
                ;;
            infrastructure)
                docker images | grep -E "(postgres|redis|rabbitmq)" | awk '{print $3}' | xargs -r docker rmi -f || true
                ;;
            *)
                docker images | grep "medicalink.*$SERVICE" | awk '{print $3}' | xargs -r docker rmi -f || true
                ;;
        esac
        
        # Clean up all Docker resources
        echo -e "${YELLOW} Cleaning up all Docker resources...${NC}"
        docker system prune -af --volumes || true
        
        # Build from scratch with no cache
        echo -e "${YELLOW} Building from scratch with no cache...${NC}"
        case $SERVICE in
            all)
                docker compose -f "$COMPOSE_FILE" build --no-cache --pull
                ;;
            infrastructure)
                COMPOSE_PARALLEL_LIMIT=2 docker compose -f "$COMPOSE_FILE" build --no-cache --parallel --pull
                ;;
            *)
                docker compose -f "$COMPOSE_FILE" build --no-cache --pull
                ;;
        esac
        
        # Start with complete recreation
        echo -e "${YELLOW} Starting services with complete recreation...${NC}"
        docker compose -f "$COMPOSE_FILE" up -d --force-recreate --renew-anon-volumes
        
        # Extended wait for complete initialization
        echo -e "${YELLOW} Waiting for services to fully initialize...${NC}"
        sleep 30
        
        # Verify service health
        echo -e "${YELLOW} Verifying service health...${NC}"
        docker compose -f "$COMPOSE_FILE" ps
        
        print_success "$SERVICE force rebuilt successfully from scratch"
        ;;
esac

echo -e "\n${MAGENTA} Current Status:${NC}"
docker compose -f "$COMPOSE_FILE" ps