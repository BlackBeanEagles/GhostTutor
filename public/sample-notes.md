# Binary Search Trees

A binary search tree stores keys so that every key in the left subtree is smaller than the node and every key in the right subtree is larger. Searching starts at the root and moves left or right, so a balanced tree answers lookups in O(log n) time.

If keys are inserted in sorted order the tree degenerates into a linked list and search becomes O(n). Self-balancing trees such as AVL trees and red-black trees fix this by performing rotations after insertions and deletions. An AVL tree keeps the height difference between subtrees at most one.

An inorder traversal of a binary search tree visits the keys in sorted order. Deleting a node with two children replaces it with its inorder successor, the smallest key in its right subtree.

# Hashing

A hash table maps keys to buckets using a hash function. Average lookup, insert and delete are O(1). When two keys land in the same bucket it is called a collision.

Separate chaining resolves collisions by storing a linked list in each bucket. Open addressing instead probes for another free slot, using linear probing, quadratic probing or double hashing. Linear probing suffers from primary clustering.

The load factor is the number of stored keys divided by the number of buckets. When the load factor grows too high the table is resized, usually doubled, and every key is rehashed.

# Sorting

Merge sort divides the array in half, sorts each half recursively and merges them. Its running time is O(n log n) in every case and it is stable, but it needs O(n) extra memory.

Quicksort chooses a pivot and partitions the array around it. Its average time is O(n log n) but the worst case is O(n²) when the pivot is always the smallest or largest element. Randomised pivot selection makes the worst case unlikely.

Heapsort builds a max-heap and repeatedly extracts the maximum. It runs in O(n log n) time with O(1) extra memory but it is not stable. Any comparison-based sort needs Omega(n log n) comparisons in the worst case.

# Graphs

Breadth-first search explores a graph level by level using a queue and finds shortest paths in unweighted graphs. Depth-first search uses a stack or recursion and is used for cycle detection and topological sorting.

Dijkstra's algorithm finds shortest paths from a source when all edge weights are non-negative. With a binary heap it runs in O((V + E) log V). Bellman-Ford handles negative edge weights and detects negative cycles in O(VE) time.

A minimum spanning tree connects all vertices with the smallest total edge weight. Kruskal's algorithm sorts edges and uses a union-find structure, while Prim's algorithm grows the tree from a starting vertex using a priority queue.
