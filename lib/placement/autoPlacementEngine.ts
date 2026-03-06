/**
 * Smart Auto-Placement Engine
 * Automatically determines optimal placement for resources based on various factors
 */

interface Resource {
  id: string;
  name: string;
  requirements: {
    cpu?: number;
    memory?: number;
    storage?: number;
    gpu?: number;
    ports?: number[];
    network?: string;
  };
  constraints?: {
    affinity?: string[];
    antiAffinity?: string[];
    nodeSelector?: Record<string, string>;
    tolerations?: string[];
  };
  priority?: number;
}

interface Node {
  id: string;
  name: string;
  capacity: {
    cpu: number;
    memory: number;
    storage: number;
    gpu: number;
    ports: number[];
  };
  available: {
    cpu: number;
    memory: number;
    storage: number;
    gpu: number;
    ports: number[];
  };
  labels: Record<string, string>;
  taints?: string[];
  status: 'ready' | 'notReady' | 'maintenance';
}

interface PlacementResult {
  nodeId: string;
  resourceName: string;
  score: number;
  reason: string;
  placements: Array<{
    resourceId: string;
    nodeId: string;
    score: number;
    conflicts?: string[];
  }>;
}

interface AutoPlacementConfig {
  scoringStrategy?: 'binpack' | 'spread' | 'balanced';
  weightCPU?: number;
  weightMemory?: number;
  weightStorage?: number;
  weightGPU?: number;
  enableAffinityScoring?: boolean;
  enableAntiAffinityScoring?: boolean;
  enableNodeLabelMatching?: boolean;
  maxScore?: number;
}

class AutoPlacementEngine {
  private defaultConfig: AutoPlacementConfig = {
    scoringStrategy: 'balanced',
    weightCPU: 0.25,
    weightMemory: 0.25,
    weightStorage: 0.25,
    weightGPU: 0.25,
    enableAffinityScoring: true,
    enableAntiAffinityScoring: true,
    enableNodeLabelMatching: true,
    maxScore: 100
  };

  /**
   * Places a single resource on the most suitable node based on scoring algorithm
   */
  placeResource(
    resource: Resource,
    nodes: Node[],
    config?: AutoPlacementConfig
  ): PlacementResult {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    const suitableNodes = nodes.filter(node => this.isNodeSuitable(resource, node));
    
    if (suitableNodes.length === 0) {
      throw new Error('PLACEMENT_FAILED_NO_NODES: No suitable nodes available for placement');
    }

    const scoredNodes = suitableNodes.map(node => ({
      node,
      score: this.calculateFitness(node, resource, finalConfig)
    }));

    const bestNode = scoredNodes.reduce((prev, current) => 
      prev.score > current.score ? prev : current
    );

    return {
      nodeId: bestNode.node.id,
      resourceName: resource.name,
      score: bestNode.score,
      reason: this.generateReason(resource, bestNode.node),
      placements: [{
        resourceId: resource.id,
        nodeId: bestNode.node.id,
        score: bestNode.score
      }]
    };
  }

  /**
   * Places multiple resources optimally across available nodes considering dependencies and constraints
   */
  placeMultiple(
    resources: Resource[],
    nodes: Node[],
    config?: AutoPlacementConfig
  ): PlacementResult {
    const finalConfig = { ...this.defaultConfig, ...config };
    const placements: Array<{
      resourceId: string;
      nodeId: string;
      score: number;
      conflicts?: string[];
    }> = [];
    const updatedNodes = [...nodes];
    
    const sortedResources = [...resources].sort((a, b) => 
      (b.priority || 0) - (a.priority || 0)
    );

    for (const resource of sortedResources) {
      try {
        const suitableNodes = updatedNodes.filter(node => 
          this.isNodeSuitable(resource, node)
        );
        
        if (suitableNodes.length === 0) {
          throw new Error(`PLACEMENT_FAILED_INSUFFICIENT_RESOURCES: No nodes available for resource ${resource.id}`);
        }

        const scoredNodes = suitableNodes.map(node => ({
          node,
          score: this.calculateFitness(node, resource, finalConfig)
        }));

        const bestNode = scoredNodes.reduce((prev, current) => 
          prev.score > current.score ? prev : current
        );

        this.updateNodeResources(bestNode.node, resource);

        placements.push({
          resourceId: resource.id,
          nodeId: bestNode.node.id,
          score: bestNode.score
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        placements.push({
          resourceId: resource.id,
          nodeId: '',
          score: 0,
          conflicts: [errorMessage]
        });
      }
    }

    const successfulPlacements = placements.filter(p => p.conflicts === undefined);
    const avgScore = successfulPlacements.length > 0 
      ? successfulPlacements.reduce((sum, p) => sum + p.score, 0) / successfulPlacements.length
      : 0;

    return {
      nodeId: successfulPlacements.length > 0 ? successfulPlacements[0].nodeId : '',
      resourceName: `${successfulPlacements.length} of ${resources.length} resources placed`,
      score: Math.round(avgScore),
      reason: `Successfully placed ${successfulPlacements.length} of ${resources.length} resources`,
      placements
    };
  }

  /**
   * Scores a node for a specific resource based on compatibility and available resources
   */
  scoreNode(
    node: Node,
    resource: Resource,
    config?: AutoPlacementConfig
  ): number {
    const finalConfig = { ...this.defaultConfig, ...config };
    return this.calculateFitness(node, resource, finalConfig);
  }

  calculateFitness(
    node: Node,
    resource: Resource,
    config: AutoPlacementConfig
  ): number {
    let score = 0;
    const maxScore = config.maxScore || 100;

    if (!this.isNodeSuitable(resource, node)) {
      return 0;
    }

    score += this.calculateResourceAvailabilityScore(node, resource, config);

    if (config.enableAffinityScoring && resource.constraints?.affinity) {
      score += this.calculateAffinityScore(node, resource, maxScore * 0.1);
    }

    if (config.enableAntiAffinityScoring && resource.constraints?.antiAffinity) {
      score += this.calculateAntiAffinityScore(node, resource, maxScore * 0.1);
    }

    if (config.enableNodeLabelMatching && resource.constraints?.nodeSelector) {
      score += this.calculateNodeLabelScore(node, resource, maxScore * 0.1);
    }

    if (config.scoringStrategy === 'binpack') {
      const utilizationScore = this.calculateUtilizationScore(node, maxScore * 0.1);
      score += utilizationScore;
    } else if (config.scoringStrategy === 'spread') {
      const spreadScore = (maxScore * 0.1) - this.calculateUtilizationScore(node, maxScore * 0.1);
      score += spreadScore;
    }

    return Math.min(score, maxScore);
  }

  private isNodeSuitable(resource: Resource, node: Node): boolean {
    if (node.status !== 'ready') {
      return false;
    }

    if (resource.requirements.cpu && node.available.cpu < resource.requirements.cpu) {
      return false;
    }

    if (resource.requirements.memory && node.available.memory < resource.requirements.memory) {
      return false;
    }

    if (resource.requirements.storage && node.available.storage < resource.requirements.storage) {
      return false;
    }

    if (resource.requirements.gpu && node.available.gpu < resource.requirements.gpu) {
      return false;
    }

    if (resource.requirements.ports && resource.requirements.ports.length > 0) {
      const availablePorts = new Set(node.available.ports);
      const requiredPorts = new Set(resource.requirements.ports);
      
      for (const port of requiredPorts) {
        if (!availablePorts.has(port)) {
          return false;
        }
      }
    }

    if (resource.constraints?.nodeSelector) {
      for (const [key, value] of Object.entries(resource.constraints.nodeSelector)) {
        if (node.labels[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  private calculateResourceAvailabilityScore(
    node: Node,
    resource: Resource,
    config: AutoPlacementConfig
  ): number {
    const maxScore = config.maxScore || 100;
    let resourceScore = 0;

    if (resource.requirements.cpu) {
      const cpuRatio = Math.min(1, resource.requirements.cpu / node.capacity.cpu);
      const cpuAvailability = (node.capacity.cpu - node.available.cpu + resource.requirements.cpu) / node.capacity.cpu;
      resourceScore += (1 - cpuRatio) * (config.weightCPU || 0.25) * maxScore * 0.4;
      resourceScore += cpuAvailability * (config.weightCPU || 0.25) * maxScore * 0.6;
    }

    if (resource.requirements.memory) {
      const memRatio = Math.min(1, resource.requirements.memory / node.capacity.memory);
      const memAvailability = (node.capacity.memory - node.available.memory + resource.requirements.memory) / node.capacity.memory;
      resourceScore += (1 - memRatio) * (config.weightMemory || 0.25) * maxScore * 0.4;
      resourceScore += memAvailability * (config.weightMemory || 0.25) * maxScore * 0.6;
    }

    if (resource.requirements.storage) {
      const storageRatio = Math.min(1, resource.requirements.storage / node.capacity.storage);
      const storageAvailability = (node.capacity.storage - node.available.storage + resource.requirements.storage) / node.capacity.storage;
      resourceScore += (1 - storageRatio) * (config.weightStorage || 0.25) * maxScore * 0.4;
      resourceScore += storageAvailability * (config.weightStorage || 0.25) * maxScore * 0.6;
    }

    if (resource.requirements.gpu) {
      const gpuRatio = Math.min(1, resource.requirements.gpu / node.capacity.gpu);
      const gpuAvailability = (node.capacity.gpu - node.available.gpu + resource.requirements.gpu) / node.capacity.gpu;
      resourceScore += (1 - gpuRatio) * (config.weightGPU || 0.25) * maxScore * 0.4;
      resourceScore += gpuAvailability * (config.weightGPU || 0.25) * maxScore * 0.6;
    }

    return resourceScore;
  }

  private calculateAffinityScore(
    node: Node,
    resource: Resource,
    maxScore: number
  ): number {
    if (!resource.constraints?.affinity) return 0;
    
    return maxScore * 0.5;
  }

  private calculateAntiAffinityScore(
    node: Node,
    resource: Resource,
    maxScore: number
  ): number {
    if (!resource.constraints?.antiAffinity) return maxScore;
    
    return maxScore * 0.3;
  }

  private calculateNodeLabelScore(
    node: Node,
    resource: Resource,
    maxScore: number
  ): number {
    if (!resource.constraints?.nodeSelector) return maxScore;
    
    let matches = 0;
    let total = 0;
    
    for (const [key, value] of Object.entries(resource.constraints.nodeSelector)) {
      total++;
      if (node.labels[key] === value) {
        matches++;
      }
    }
    
    return (matches / total) * maxScore;
  }

  private calculateUtilizationScore(node: Node, maxScore: number): number {
    const cpuUtilization = (node.capacity.cpu - node.available.cpu) / node.capacity.cpu;
    const memoryUtilization = (node.capacity.memory - node.available.memory) / node.capacity.memory;
    const storageUtilization = (node.capacity.storage - node.available.storage) / node.capacity.storage;
    
    const avgUtilization = (cpuUtilization + memoryUtilization + storageUtilization) / 3;
    return avgUtilization * maxScore;
  }

  private updateNodeResources(node: Node, resource: Resource): void {
    if (resource.requirements.cpu) {
      node.available.cpu -= resource.requirements.cpu;
    }
    
    if (resource.requirements.memory) {
      node.available.memory -= resource.requirements.memory;
    }
    
    if (resource.requirements.storage) {
      node.available.storage -= resource.requirements.storage;
    }
    
    if (resource.requirements.gpu) {
      node.available.gpu -= resource.requirements.gpu;
    }
    
    if (resource.requirements.ports) {
      resource.requirements.ports.forEach(port => {
        const index = node.available.ports.indexOf(port);
        if (index !== -1) {
          node.available.ports.splice(index, 1);
        }
      });
    }
  }

  /**
   * Generates a human-readable reason for the placement decision
   */
  private generateReason(resource: Resource, node: Node): string {
    const reasons: string[] = [];

    if (resource.requirements.cpu && node.available.cpu >= resource.requirements.cpu) {
      reasons.push("Sufficient CPU available");
    }

    if (resource.requirements.memory && node.available.memory >= resource.requirements.memory) {
      reasons.push("Sufficient memory available");
    }

    if (resource.requirements.storage && node.available.storage >= resource.requirements.storage) {
      reasons.push("Sufficient storage available");
    }

    if (resource.constraints?.nodeSelector) {
      const allMatched = Object.entries(resource.constraints.nodeSelector).every(
        ([key, value]) => node.labels[key] === value
      );
      if (allMatched) {
        reasons.push("Node selector labels match");
      }
    }

    if (reasons.length === 0) {
      return "Node is suitable for placement";
    }

    return reasons.join(", ");
  }
}

export { AutoPlacementEngine };
export type { Resource, Node, PlacementResult, AutoPlacementConfig };