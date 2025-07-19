import re
from .exceptions import SGFParseError

class SGFParser:
    """
    Parses a string of SGF data to extract game moves.
    """
    def __init__(self, sgf_content: str):
        if not isinstance(sgf_content, str):
            raise SGFParseError("SGF content must be a string.")
        self.sgf_content = sgf_content
        self.board_size = self._get_board_size()

    def _get_board_size(self) -> int:
        """Finds the board size (SZ) property in the SGF content."""
        match = re.search(r'SZ\[(\d+)\]', self.sgf_content, re.IGNORECASE)
        if match:
            return int(match.group(1))
        return 19  # Default to 19x19 if not specified

    def sgf_to_coords(self, sgf_coord: str) -> tuple:
        """Converts an SGF coordinate string (e.g., 'pd') to numerical (x, y) coordinates."""
        # Handle pass moves. An empty coordinate `[]` or `tt` for 19x19 means pass.
        if not sgf_coord or (self.board_size == 19 and sgf_coord == 'tt'):
            return None, None

        if len(sgf_coord) != 2:
            raise SGFParseError(f"Invalid SGF coordinate format: '{sgf_coord}'")
        
        col_str = sgf_coord[0].lower()
        row_str = sgf_coord[1].lower()

        x = ord(col_str) - ord('a')
        y = ord(row_str) - ord('a')

        if not (0 <= x < self.board_size and 0 <= y < self.board_size):
            raise SGFParseError(f"Coordinate '{sgf_coord}' is out of bounds for board size {self.board_size}.")

        return x, y

    def parse(self) -> list:
        """
        Parses the SGF content and returns a list of move dictionaries.
        """
        moves = []
        # Regex to find all move nodes, e.g., ';B[pd]' or ';W[]'.
        # This handles optional whitespace and variations in property names.
        move_pattern = re.compile(r';\s*([BW])\s*\[\s*([a-z]*)\s*\]', re.IGNORECASE)
        
        for match in move_pattern.finditer(self.sgf_content):
            player = match.group(1).upper()
            sgf_coords = match.group(2).lower()
            
            x, y = self.sgf_to_coords(sgf_coords)

            moves.append({
                'player': player,
                'sgf_coords': sgf_coords if sgf_coords else 'pass',
                'x': x,
                'y': y
            })

        if not moves:
            raise SGFParseError("No valid B/W move nodes found in the SGF file.")
            
        return moves