import itertools

class GoBoard:
    def __init__(self, size=19):
        self.size = size
        self.board = [[0] * size for _ in range(size)]
        self.history = []

    def is_valid_move(self, x, y, player):
        if not (0 <= x < self.size and 0 <= y < self.size): return False
        if self.board[y][x] != 0: return False
        
        # Create a temporary board to check for suicide
        temp_board = [row[:] for row in self.board]
        temp_board[y][x] = player
        
        # Check if the move captures any stones
        captured_stones = self._get_captured_stones(x, y, player, temp_board)
        if captured_stones:
            return True

        # Check for suicide
        group, liberties = self._get_group_and_liberties(x, y, player, temp_board)
        if not liberties:
            return False

        # Ko check might be needed here in a full implementation
        return True

    def play_move(self, x, y, player):
        if not self.is_valid_move(x, y, player):
            return [] # No stones captured
        
        self.board[y][x] = player
        captured_stones = self._get_captured_stones(x, y, player, self.board)

        for (cx, cy) in captured_stones:
            self.board[cy][cx] = 0
        
        self.history.append(([row[:] for row in self.board]))
        return captured_stones

    def _get_captured_stones(self, x, y, player, board_state):
        captured_stones = []
        opponent = 3 - player
        for (nx, ny) in self.get_neighbors(x,y):
            if board_state[ny][nx] == opponent:
                group, liberties = self._get_group_and_liberties(nx, ny, opponent, board_state)
                if not liberties:
                    captured_stones.extend(group)
        return captured_stones

    def get_neighbors(self, x, y):
        neighbors = []
        if x > 0: neighbors.append((x-1, y))
        if x < self.size - 1: neighbors.append((x+1, y))
        if y > 0: neighbors.append((x, y-1))
        if y < self.size - 1: neighbors.append((x, y+1))
        return neighbors

    def get_group(self, x, y):
        """ Public method to get group details from the current board state. """
        player = self.board[y][x]
        if player == 0:
            return [], set(), 0
        
        stones, liberties = self._get_group_and_liberties(x, y, player, self.board)
        return stones, liberties, player

    def _get_group_and_liberties(self, x, y, player, board_state):
        if not (0 <= x < self.size and 0 <= y < self.size) or board_state[y][x] != player:
            return [], set()

        q = [(x,y)]
        stones_in_group = set([(x,y)])
        liberties = set()
        visited = set([(x,y)])

        while q:
            cx, cy = q.pop(0)
            for (nx, ny) in self.get_neighbors(cx, cy):
                if (nx, ny) not in visited:
                    visited.add((nx,ny))
                    if board_state[ny][nx] == 0:
                        liberties.add((nx,ny))
                    elif board_state[ny][nx] == player:
                        stones_in_group.add((nx,ny))
                        q.append((nx,ny))
        
        return list(stones_in_group), liberties

    def get_liberties(self, x, y):
        """ Convenience method to just get liberties for a stone's group. """
        _, liberties, _ = self.get_group(x, y)
        return liberties

    def get_liberties_for_stones(self, stones):
        """ Get the set of liberties for a given collection of stones. """
        liberties = set()
        for (sx, sy) in stones:
            for (nx, ny) in self.get_neighbors(sx, sy):
                if self.board[ny][nx] == 0:
                    liberties.add((nx, ny))
        return liberties

    def get_board_state(self):
        return self.board

    @staticmethod
    def sgf_to_coords(sgf_coord, board_size=19):
        if not sgf_coord or len(sgf_coord) != 2: return None, None
        col_str = sgf_coord[0]
        row_str = sgf_coord[1]
        x = ord(col_str) - ord('a')
        y = ord(row_str) - ord('a')
        return x, y