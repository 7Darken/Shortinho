.PHONY: build run stop logs clean test help

# Nom de l'image Docker
IMAGE_NAME := oshii-backend
PORT := 3000

# Couleurs pour les messages
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Afficher l'aide
	@echo "$(GREEN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo "$(GREEN)  🐳 Makefile - Backend Oshii$(NC)"
	@echo "$(GREEN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo ""
	@echo "$(YELLOW)Commandes disponibles:$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

build: ## Construire l'image Docker
	@echo "$(YELLOW)📦 Construction de l'image Docker...$(NC)"
	docker build -t $(IMAGE_NAME) .
	@echo "$(GREEN)✅ Image construite avec succès!$(NC)"

run: ## Lancer le conteneur (nécessite .env)
	@echo "$(YELLOW)🚀 Démarrage du conteneur...$(NC)"
	docker run -d --name $(IMAGE_NAME) -p $(PORT):3000 --env-file .env $(IMAGE_NAME)
	@echo "$(GREEN)✅ Conteneur démarré sur http://localhost:$(PORT)$(NC)"

start: build run ## Construire et lancer le conteneur

stop: ## Arrêter le conteneur
	@echo "$(YELLOW)🛑 Arrêt du conteneur...$(NC)"
	@docker stop $(IMAGE_NAME) 2>/dev/null || true
	@docker rm $(IMAGE_NAME) 2>/dev/null || true
	@echo "$(GREEN)✅ Conteneur arrêté$(NC)"

restart: stop start ## Redémarrer le conteneur

logs: ## Afficher les logs du conteneur
	docker logs -f $(IMAGE_NAME)

clean: stop ## Nettoyer l'image et le conteneur
	@echo "$(YELLOW)🧹 Nettoyage...$(NC)"
	@docker rmi $(IMAGE_NAME) 2>/dev/null || true
	@echo "$(GREEN)✅ Nettoyage terminé$(NC)"

test: ## Tester l'API
	@echo "$(YELLOW)🧪 Test de l'API...$(NC)"
	@curl -s http://localhost:$(PORT)/health | python3 -m json.tool || echo "$(RED)❌ API non accessible$(NC)"

shell: ## Ouvrir un shell dans le conteneur
	docker exec -it $(IMAGE_NAME) sh

stats: ## Afficher les statistiques du conteneur
	docker stats $(IMAGE_NAME)

